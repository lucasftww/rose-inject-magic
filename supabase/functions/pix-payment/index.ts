import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MISTICPAY_BASE_URL = "https://api.misticpay.com/api";

// ─── Structured Logger ────────────────────────────────────────────────────────
function log(level: "INFO" | "WARN" | "ERROR", ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, ctx, msg, ...(data || {}) };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

type RobotCredentials = { username: string; password: string };
type RobotGameSnapshot = {
  game: any | null;
  balance: number | null;
  expectedPrice: number | null;
  availableSlots: number | null;
  reason?: string;
};

async function getRobotCredentials(supabaseAdmin: any): Promise<RobotCredentials | null> {
  const [uRes, pRes] = await Promise.all([
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_USERNAME").maybeSingle(),
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_PASSWORD").maybeSingle(),
  ]);

  const username = uRes.data?.value || Deno.env.get("ROBOT_API_USERNAME");
  const password = pRes.data?.value || Deno.env.get("ROBOT_API_PASSWORD");
  if (!username || !password) return null;

  return { username, password };
}

function robotAuthHeader(creds: RobotCredentials) {
  return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
}

async function fetchRobotGameSnapshot(
  creds: RobotCredentials,
  robotGameId: number,
  duration: number,
): Promise<RobotGameSnapshot> {
  const gamesRes = await fetch("https://api.robotproject.com.br/games", {
    headers: {
      Authorization: robotAuthHeader(creds),
      "Content-Type": "application/json",
    },
  });

  if (!gamesRes.ok) {
    return {
      game: null,
      balance: null,
      expectedPrice: null,
      availableSlots: null,
      reason: `Falha ao consultar o provedor Robot (HTTP ${gamesRes.status}).`,
    };
  }

  const gamesData = await gamesRes.json();
  const games = Array.isArray(gamesData) ? gamesData : gamesData.games || [];
  const game = games.find((g: any) => Number(g.id) === Number(robotGameId)) || null;
  const parsedBalance = Number(Array.isArray(gamesData) ? NaN : gamesData?.balance);
  const balance = Number.isFinite(parsedBalance) ? parsedBalance : null;

  if (!game) {
    return {
      game: null,
      balance,
      expectedPrice: null,
      availableSlots: null,
      reason: "Produto não encontrado na Robot API.",
    };
  }

  const expectedRaw = game.prices?.[String(duration)] ?? game.prices?.["1"] ?? null;
  const parsedExpectedPrice = Number(expectedRaw);
  const expectedPrice = Number.isFinite(parsedExpectedPrice) ? parsedExpectedPrice : null;
  const parsedMaxKeys = Number(game.maxKeys);
  const maxKeys = game.maxKeys == null || !Number.isFinite(parsedMaxKeys) ? null : parsedMaxKeys;
  const soldKeys = Number(game.soldKeys || 0);
  const availableSlots = maxKeys === null ? null : Math.max(0, maxKeys - soldKeys);

  if (game.status !== "on") {
    return { game, balance, expectedPrice, availableSlots, reason: "Produto offline no provedor no momento." };
  }

  if (!game.is_free && (expectedPrice === null || expectedPrice <= 0)) {
    return {
      game,
      balance,
      expectedPrice,
      availableSlots,
      reason: `A duração de ${duration} dia(s) não está disponível na Robot API.`,
    };
  }

  if (!game.is_free && availableSlots !== null && availableSlots <= 0) {
    return { game, balance, expectedPrice, availableSlots, reason: "Sem slots disponíveis no provedor no momento." };
  }

  if (!game.is_free && balance !== null && expectedPrice !== null && balance < expectedPrice) {
    return {
      game,
      balance,
      expectedPrice,
      availableSlots,
      reason: `Saldo insuficiente no provedor para entrega automática. Disponível: $${balance.toFixed(2)} • Necessário: $${expectedPrice.toFixed(2)}`,
    };
  }

  return { game, balance, expectedPrice, availableSlots };
}

// ─── Server-side CAPI Purchase (fires when payment is COMPLETED) ────────────
// This guarantees Meta receives the Purchase event even if the user closes the browser.
// Uses the same deterministic event_id as the browser Pixel for deduplication.
const META_PIXEL_ID = "4378225905838577";
const META_GRAPH_VERSION = "v21.0";

async function sendServerPurchaseEvent(payment: any, req: Request) {
  try {
    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) return;

    const cartItems = (payment.cart_snapshot || []) as Array<{
      productId: string;
      productName: string;
      planName?: string;
      price: number;
      quantity?: number;
      lztGame?: string;
    }>;
    if (cartItems.length === 0) return;

    const firstItem = cartItems[0];
    const totalValue = (payment.amount || 0) / 100; // amount is in centavos

    // Deterministic event_id — must match browser-side for deduplication
    const eventId = `purchase_${payment.id}`;

    // Resolve category
    const gameName = firstItem.lztGame || firstItem.planName || "";
    const lower = gameName.toLowerCase();
    let category = "Outros";
    if (lower.includes("valorant")) category = "Valorant";
    else if (lower.includes("fortnite")) category = "Fortnite";
    else if (lower.includes("roblox")) category = "Roblox";
    else if (lower.includes("minecraft")) category = "Minecraft";
    else if (lower.includes("lol") || lower.includes("league")) category = "League of Legends";
    else if (lower.includes("cs") || lower.includes("counter")) category = "CS2";
    else if (lower.includes("gta")) category = "GTA";

    // Server-side user_data
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") || undefined;

    const userData: Record<string, string> = {};
    if (clientIp) userData.client_ip_address = clientIp;
    const ua = req.headers.get("user-agent");
    if (ua) userData.client_user_agent = ua;

    const contentIds = cartItems.map((i) => i.productId);

    const eventData = {
      event_name: "Purchase",
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: "https://rose-inject-magic.lovable.app/checkout",
      user_data: userData,
      custom_data: {
        content_name: firstItem.productName,
        content_category: category,
        content_ids: contentIds,
        contents: contentIds.map((id: string) => ({ id, quantity: 1 })),
        content_type: "product",
        value: totalValue,
        currency: "BRL",
        transaction_id: payment.id,
      },
    };

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${accessToken}`;

    // Retry up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [eventData] }),
        });
        if (res.ok) {
          console.log(`CAPI Purchase sent successfully (attempt ${attempt}):`, payment.id);
          return;
        }
        const errBody = await res.text();
        console.error(`CAPI Purchase attempt ${attempt} failed:`, res.status, errBody);
      } catch (err) {
        console.error(`CAPI Purchase attempt ${attempt} error:`, err);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  } catch (err) {
    console.error("sendServerPurchaseEvent error:", err);
  }
}

// Helper: send Discord webhook notification on sale
async function sendDiscordSaleNotification(supabaseAdmin: any, payment: any) {
  try {
    const { data: webhookCred } = await supabaseAdmin
      .from("system_credentials")
      .select("value")
      .eq("env_key", "DISCORD_WEBHOOK_URL")
      .maybeSingle();

    const webhookUrl = webhookCred?.value;
    if (!webhookUrl) {
      console.log("DISCORD_WEBHOOK_URL not configured, skipping notification");
      return;
    }

    const cartItems = payment.cart_snapshot as Array<{
      productName: string;
      planName: string;
      price: number;
      quantity: number;
    }>;

    const totalAmount = (payment.amount / 100).toFixed(2);
    // discount_amount is stored in reais (NOT centavos), don't divide by 100
    const discount = payment.discount_amount ? Number(payment.discount_amount).toFixed(2) : null;

    const itemsList = cartItems.map((item) =>
      `> 🎮 **${item.productName}** — ${item.planName}\n> 💵 R$ ${Number(item.price).toFixed(2)} × ${item.quantity || 1}`
    ).join("\n\n");

    const now = new Date();
    const timestamp = now.toISOString();

    const embed = {
      title: "💰 Nova Venda Realizada!",
      description: `@everyone\n\n${itemsList}`,
      color: 0x00FF6A,
      fields: [
        {
          name: "💲 Valor Total",
          value: `**R$ ${totalAmount}**`,
          inline: true,
        },
        ...(discount ? [{
          name: "🏷️ Desconto",
          value: `R$ ${discount}`,
          inline: true,
        }] : []),
        {
          name: "📦 Itens",
          value: `${cartItems.length} produto(s)`,
          inline: true,
        },
      ],
      footer: {
        text: "Royal Store • Sistema de Vendas",
      },
      timestamp,
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      console.error("Discord webhook error:", res.status, await res.text());
    } else {
      console.log("Discord sale notification sent successfully");
    }
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}
// Helper: assign Discord "Cliente" role to buyer after purchase
async function assignDiscordClientRole(supabaseAdmin: any, userId: string) {
  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      console.log("DISCORD_BOT_TOKEN not configured, skipping role assignment");
      return;
    }

    // Get guild and role IDs from system_credentials
    const { data: creds } = await supabaseAdmin
      .from("system_credentials")
      .select("env_key, value")
      .in("env_key", ["DISCORD_GUILD_ID", "DISCORD_CLIENT_ROLE_ID"]);

    const guildId = creds?.find((c: any) => c.env_key === "DISCORD_GUILD_ID")?.value;
    const roleId = creds?.find((c: any) => c.env_key === "DISCORD_CLIENT_ROLE_ID")?.value;

    if (!guildId || !roleId) {
      console.log("Discord Guild/Role IDs not configured, skipping role assignment");
      return;
    }

    // Get user's Discord identity from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const identities = authUser?.user?.identities || [];
    const discordIdentity = identities.find((i: any) => i.provider === "discord");

    if (!discordIdentity) {
      console.log("User has no Discord identity, skipping role assignment");
      return;
    }

    const discordUserId = discordIdentity.provider_id;

    // Add role via Discord API
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.ok || res.status === 204) {
      console.log(`Discord role assigned to user ${discordUserId}`);
    } else {
      const errBody = await res.text();
      console.error(`Discord role assignment failed [${res.status}]:`, errBody);
    }
  } catch (err) {
    console.error("assignDiscordClientRole error:", err);
  }
}

// Helper: fulfill order (deliver stock, create tickets, record coupon)
async function fulfillOrder(supabaseAdmin: any, payment: any) {
  log("INFO", "fulfillOrder", "Starting fulfillment", { paymentId: payment.id, userId: payment.user_id, itemCount: payment.cart_snapshot?.length, amount: payment.amount });
  const cartItems = payment.cart_snapshot as Array<{
    productId: string;
    planId: string;
    productName: string;
    planName: string;
    price: number;
    quantity: number;
    type?: string;
    lztItemId?: string;
    lztPrice?: number;
    lztCurrency?: string;
  }>;

  // Check if buyer is a reseller
  const { data: resellerData } = await supabaseAdmin
    .from("resellers")
    .select("id, discount_percent, total_purchases")
    .eq("user_id", payment.user_id)
    .eq("active", true)
    .maybeSingle();

  // Fetch reseller's authorized products if they are a reseller
  let resellerProductIds: string[] = [];
  if (resellerData) {
    const { data: rProducts } = await supabaseAdmin
      .from("reseller_products")
      .select("product_id")
      .eq("reseller_id", resellerData.id);
    resellerProductIds = (rProducts || []).map((rp: any) => rp.product_id);
    log("INFO", "fulfillOrder", "Reseller detected", { resellerId: resellerData.id, discount: resellerData.discount_percent, authorizedProducts: resellerProductIds.length });
  }

  for (const item of cartItems) {
    log("INFO", "fulfillOrder", "Processing item", { productName: item.productName, planName: item.planName, type: item.type, qty: item.quantity, price: item.price });

    // Skip raspadinha items - fulfillment handled client-side
    if (item.type === "raspadinha" || item.planId === "raspadinha") {
      log("INFO", "fulfillOrder", "Skipping raspadinha (handled client-side)");
      continue;
    }

    // Handle LZT Market accounts (check type or planId fallback)
    const isLztAccount = item.type === "lzt-account" || item.planId === "lzt-account";
    if (isLztAccount) {
      const lztItemId = item.lztItemId || item.productId?.replace("lzt-", "") || "";
      if (lztItemId) {
        log("INFO", "fulfillOrder", "Fulfilling LZT account", { lztItemId });
        await fulfillLztAccount(supabaseAdmin, payment, { ...item, lztItemId });
      } else {
        log("ERROR", "fulfillOrder", "LZT account missing lztItemId", { item });
      }
      continue;
    }

    // Regular product fulfillment
    // Check if this product uses Robot Project API
    const { data: productData } = await supabaseAdmin
      .from("products")
      .select("robot_game_id, robot_markup_percent")
      .eq("id", item.productId)
      .maybeSingle();

    const { data: planData } = await supabaseAdmin
      .from("product_plans")
      .select("price, robot_duration_days")
      .eq("id", item.planId)
      .maybeSingle();

    const isRobotProduct = productData?.robot_game_id && productData.robot_game_id > 0;
    let originalPrice = item.price || 0;
    if (resellerData && planData) {
      originalPrice = Number(planData.price);
    }

    for (let i = 0; i < (item.quantity || 1); i++) {
      if (isRobotProduct) {
        log("INFO", "fulfillOrder", "Robot product detected", { productId: item.productId, robotGameId: productData.robot_game_id, duration: planData?.robot_duration_days });
        await fulfillRobotProduct(supabaseAdmin, payment, item, productData, planData);
      } else {
        // Standard stock-based fulfillment — atomic claim to prevent race conditions
        let stockId: string | null = null;
        const { data: claimedId } = await supabaseAdmin.rpc("claim_stock_item", { _plan_id: item.planId });
        if (claimedId) {
          stockId = claimedId;
        }
        log("INFO", "fulfillOrder", "Stock claim", { planId: item.planId, stockFound: !!stockId });

        const { data: ticket } = await supabaseAdmin
          .from("order_tickets")
          .insert({
            user_id: payment.user_id,
            product_id: item.productId,
            product_plan_id: item.planId,
            stock_item_id: stockId,
            status: stockId ? "delivered" : "open",
            status_label: stockId ? "Entregue" : "Aguardando Equipe",
          })
          .select("id")
          .single();

        if (ticket && !stockId) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: payment.user_id,
            sender_role: "staff",
            message: "⏳ Seu pagamento foi confirmado! No momento não temos este item em estoque. Nossa equipe irá entregar manualmente em breve. Aguarde.",
          });
        }

        if (ticket && stockId) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: payment.user_id,
            sender_role: "staff",
            message: "✅ Seu produto foi entregue automaticamente! Veja a chave acima.",
          });

          const { data: tutorialData } = await supabaseAdmin
            .from("product_tutorials")
            .select("tutorial_text, tutorial_file_url")
            .eq("product_id", item.productId)
            .maybeSingle();

          if (tutorialData?.tutorial_text) {
            const txtContent = tutorialData.tutorial_text;
            const txtBlob = new Blob([txtContent], { type: "text/plain" });
            const txtPath = `tutorials/${crypto.randomUUID()}.txt`;
            const { error: uploadErr } = await supabaseAdmin.storage
              .from("game-images")
              .upload(txtPath, txtBlob, { contentType: "text/plain" });

            if (!uploadErr) {
              const { data: urlData } = supabaseAdmin.storage.from("game-images").getPublicUrl(txtPath);
              await supabaseAdmin.from("ticket_messages").insert({
                ticket_id: ticket.id,
                sender_id: payment.user_id,
                sender_role: "staff",
                message: `📖 **Tutorial:** ${urlData.publicUrl}`,
              });
            }
          }

          if (tutorialData?.tutorial_file_url) {
            await supabaseAdmin.from("ticket_messages").insert({
              ticket_id: ticket.id,
              sender_id: payment.user_id,
              sender_role: "staff",
              message: `📎 **Arquivo:** ${tutorialData.tutorial_file_url}`,
            });
          }
        }

        if (resellerData && resellerProductIds.includes(item.productId)) {
          await supabaseAdmin.from("reseller_purchases").insert({
            reseller_id: resellerData.id,
            original_price: originalPrice,
            paid_price: item.price || 0,
          });

          await supabaseAdmin.rpc("increment_reseller_purchases", { _reseller_id: resellerData.id }).catch(() => {
            supabaseAdmin
              .from("resellers")
              .update({ total_purchases: (resellerData.total_purchases || 0) + 1 })
              .eq("id", resellerData.id);
          });
        }
      }
    }
  }

  // Record coupon usage and increment counter
  if (payment.coupon_id) {
    log("INFO", "fulfillOrder", "Recording coupon usage", { couponId: payment.coupon_id, userId: payment.user_id });
    await supabaseAdmin
      .from("coupon_usage")
      .insert({ coupon_id: payment.coupon_id, user_id: payment.user_id });
    
    // Increment current_uses on the coupon so max_uses limit works
    await supabaseAdmin.rpc("increment_coupon_uses", { _coupon_id: payment.coupon_id }).catch(async () => {
      // Fallback: manual increment if RPC doesn't exist
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("current_uses")
        .eq("id", payment.coupon_id)
        .single();
      if (coupon) {
        await supabaseAdmin
          .from("coupons")
          .update({ current_uses: (coupon.current_uses || 0) + 1 })
          .eq("id", payment.coupon_id);
      }
    });
  }
}

// LZT Market account purchase and delivery
async function fulfillLztAccount(supabaseAdmin: any, payment: any, item: any) {
  const { data: lztCred } = await supabaseAdmin
    .from("system_credentials")
    .select("value")
    .eq("env_key", "LZT_API_TOKEN")
    .maybeSingle();
  const LZT_TOKEN = lztCred?.value || Deno.env.get("LZT_MARKET_TOKEN");

  const itemId = item.lztItemId;
  let price = item.lztPrice;
  let currency = item.lztCurrency || "rub";

  const lztGame = item.lztGame || "valorant";

  const findProductAndPlan = async () => {
    let productId: string | null = null;
    let planId: string | null = null;

    // Try game-specific product name first (multiple patterns per game)
    const gameSearchPatterns: Record<string, string[]> = {
      valorant: ["%valorant%conta%", "%conta%valorant%", "%valorant%"],
      lol: ["%lol%conta%", "%conta%lol%", "%league%", "%lol%"],
      fortnite: ["%fortnite%conta%", "%conta%fortnite%", "%fortnite%"],
      minecraft: ["%minecraft%conta%", "%conta%minecraft%", "%minecraft%"],
    };

    const patterns = gameSearchPatterns[lztGame] || gameSearchPatterns.valorant;
    for (const pattern of patterns) {
      if (productId) break;
      const { data: found } = await supabaseAdmin
        .from("products")
        .select("id")
        .ilike("name", pattern)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (found) productId = found.id;
    }

    // Fallback: try to find any product with "conta" in the name (avoid cheats/robots)
    if (!productId) {
      const { data: contaFallback } = await supabaseAdmin
        .from("products")
        .select("id")
        .ilike("name", "%conta%")
        .eq("active", true)
        .is("robot_game_id", null)
        .limit(1)
        .maybeSingle();
      productId = contaFallback?.id || null;
    }

    // Last resort: any product WITHOUT robot_game_id (avoid cheats/tools)
    if (!productId) {
      const { data: fallback } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("active", true)
        .is("robot_game_id", null)
        .limit(1)
        .maybeSingle();
      productId = fallback?.id || null;
    }

    // Absolute last resort: any active product
    if (!productId) {
      const { data: anyFallback } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("active", true)
        .limit(1)
        .single();
      productId = anyFallback?.id || null;
    }

    if (productId) {
      const { data: plan } = await supabaseAdmin
        .from("product_plans")
        .select("id")
        .eq("product_id", productId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      planId = plan?.id || null;
    }

    return { productId, planId };
  };

  const createManualDeliveryTicket = async (reason: string) => {
    console.log(`Creating manual delivery ticket for LZT item ${itemId}. Reason: ${reason}`);

    const { productId, planId } = await findProductAndPlan();
    if (!productId || !planId) {
      console.error("No product/plan found for LZT manual delivery ticket");
      return;
    }

    const gameLabelsManual: Record<string, string> = {
      valorant: "Valorant", lol: "LoL", fortnite: "Fortnite", minecraft: "Minecraft",
    };
    const gameLabelManual = gameLabelsManual[lztGame] || "LZT";

    const lztMetadata = {
      type: "lzt-account",
      lzt_item_id: itemId,
      account_name: item.productName || `Conta ${gameLabelManual} #${itemId}`,
      title: item.productName || `Conta ${gameLabelManual} #${itemId}`,
      account_image: item.productImage || null,
      price_paid: item.price || price,
      sell_price: item.price || 0,
      currency: currency,
      skins_count: item.skinsCount || null,
      game: lztGame,
      manual_delivery: true,
      failure_reason: reason,
    };

    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: productId,
        product_plan_id: planId,
        stock_item_id: null,
        status: "open",
        status_label: "Entrega Manual",
        metadata: lztMetadata,
      })
      .select("id")
      .single();

    if (ticket) {
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ Seu pagamento foi confirmado!\n\n⚠️ Houve um problema ao processar a entrega automática da conta. Nossa equipe irá entregar manualmente em breve.\n\nSe tiver dúvidas, envie uma mensagem aqui neste chat.`,
      });
    }

    // Record sale even for manual delivery so admin can track revenue
    const RUB_TO_BRL_MD = 0.055;
    const buyPriceMd = currency === "rub" ? Number(price || 0) * RUB_TO_BRL_MD : Number(price || 0);
    const sellPriceMd = Number(item.price) || 0;
    await supabaseAdmin.from("lzt_sales").insert({
      lzt_item_id: String(itemId),
      buy_price: buyPriceMd,
      sell_price: sellPriceMd,
      profit: sellPriceMd - buyPriceMd,
      title: item.productName || `Conta ${gameLabelManual} #${itemId}`,
      game: lztGame,
      buyer_user_id: payment.user_id,
    }).then(({ error: saleErr }) => {
      if (saleErr) console.error("Failed to record manual lzt_sale:", saleErr);
      else console.log("Manual LZT sale recorded:", itemId);
    });

    return ticket;
  };

  if (!LZT_TOKEN) {
    console.error("LZT_MARKET_TOKEN not configured — falling back to manual delivery");
    await createManualDeliveryTicket("LZT token not configured");
    return;
  }

  if (!price) {
    console.log(`Fetching current price for LZT item ${itemId}...`);
    try {
      const detailRes = await fetch(`https://api.lzt.market/${encodeURIComponent(itemId)}`, {
        headers: { Authorization: `Bearer ${LZT_TOKEN}`, Accept: "application/json" },
      });
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        price = detailData.item?.price;
        currency = detailData.item?.price_currency || currency;
        console.log(`Got price: ${price} ${currency}`);
      }
    } catch (err) {
      console.error("Failed to fetch LZT item price:", err);
    }
  }

  if (!price) {
    console.error(`Cannot purchase LZT item ${itemId}: no price available — falling back to manual delivery`);
    await createManualDeliveryTicket("Price not available");
    return;
  }

  // Pre-check: verify account is still available before purchasing
  console.log(`Pre-checking availability for LZT item ${itemId}...`);
  try {
    const checkRes = await fetch(`https://api.lzt.market/${encodeURIComponent(itemId)}`, {
      headers: { Authorization: `Bearer ${LZT_TOKEN}`, Accept: "application/json" },
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      const checkItem = checkData.item;
      if (checkItem?.buyer) {
        console.error(`LZT item ${itemId} already sold to buyer ${checkItem.buyer}`);
        await createManualDeliveryTicket("Account already sold before purchase attempt");
        return;
      }
      if (checkItem?.canBuyItem === false) {
        console.error(`LZT item ${itemId} cannot be purchased (canBuyItem=false)`);
        await createManualDeliveryTicket("Account not available for purchase");
        return;
      }
      // Update price to latest if it changed
      if (checkItem?.price && checkItem.price !== price) {
        console.log(`Price changed from ${price} to ${checkItem.price} ${checkItem.price_currency || currency}`);
        price = checkItem.price;
        currency = checkItem.price_currency || currency;
      }
    }
  } catch (err) {
    console.warn("Pre-check failed, proceeding with purchase anyway:", err);
  }

  console.log(`Purchasing LZT account ${itemId} at price ${price} ${currency}`);

  try {
    const buyUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;

    const buyRes = await fetch(buyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LZT_TOKEN}`,
        Accept: "application/json",
      },
    });

    const buyData = await buyRes.json();
    console.log("LZT fast-buy result:", buyRes.status, JSON.stringify(buyData).substring(0, 1000));

    if (!buyRes.ok) {
      const reason = `HTTP ${buyRes.status}: ${JSON.stringify(buyData).substring(0, 300)}`;
      console.error("LZT fast-buy failed:", reason);
      await createManualDeliveryTicket(reason);
      return;
    }

    const boughtItem = buyData.item;
    const loginData = boughtItem?.loginData;

    let email = loginData?.login || loginData?.email || boughtItem?.email || "";
    let password = loginData?.password || boughtItem?.password || "";
    let rawCredentials = loginData?.raw || "";
    // Preserve full email login data (login + password) if available
    let accountEmail: any = boughtItem?.emailLoginData || loginData?.emailLoginData || loginData?.email || boughtItem?.email || "";

    if (!email && rawCredentials) {
      const parts = rawCredentials.split(":");
      if (parts.length >= 2) {
        email = parts[0];
        password = parts.slice(1).join(":");
      }
    }

    // If accountEmail is a string and equals the main login, try to get richer data
    if (typeof accountEmail === "string" && accountEmail === email && boughtItem?.item_origin === "autoreg") {
      accountEmail = boughtItem?.emailLoginData || boughtItem?.email || loginData?.email || "";
    }

    const stockContent = email && password
      ? `Email: ${email}\nSenha: ${password}`
      : rawCredentials
        ? rawCredentials
        : `Conta #${itemId} - Dados: ${JSON.stringify(buyData).substring(0, 500)}`;

    const { productId, planId } = await findProductAndPlan();

    if (!productId || !planId) {
      console.error("No product/plan found for LZT account ticket after successful purchase");
      return;
    }

    const { data: stockItem } = await supabaseAdmin
      .from("stock_items")
      .insert({
        product_plan_id: planId,
        content: stockContent,
        used: true,
        used_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const gameLabels: Record<string, string> = {
      valorant: "Valorant", lol: "LoL", fortnite: "Fortnite", minecraft: "Minecraft",
    };
    const gameLabel = gameLabels[lztGame] || "LZT";

    const lztMetadata = {
      type: "lzt-account",
      lzt_item_id: itemId,
      account_name: item.productName || `Conta ${gameLabel} #${itemId}`,
      title: item.productName || `Conta ${gameLabel} #${itemId}`,
      account_image: item.productImage || null,
      price_paid: item.price || price,
      sell_price: item.price || 0,
      currency: currency,
      skins_count: item.skinsCount || null,
      game: lztGame,
    };

    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: productId,
        product_plan_id: planId,
        stock_item_id: stockItem?.id || null,
        status: "delivered",
        status_label: "Entregue",
        metadata: lztMetadata,
      })
      .select("id")
      .single();

    if (ticket && email) {
      const credentialData = JSON.stringify({ login: email, password: password, email: accountEmail, game: lztGame });
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `[CREDENTIALS]${credentialData}`,
      });
    } else if (ticket && !email) {
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ Conta #${itemId} comprada com sucesso!\n\nDados brutos:\n\`\`\`\n${rawCredentials || JSON.stringify(buyData?.item?.loginData || buyData, null, 2).substring(0, 800)}\n\`\`\`\n\nSe precisar de ajuda para acessar, envie uma mensagem aqui.`,
      });
    }

    const RUB_TO_BRL = 0.055;
    const buyPriceBrl = currency === "rub" ? Number(price) * RUB_TO_BRL : Number(price);
    const sellPriceBrl = Number(item.price) || 0;
    const { error: saleErr } = await supabaseAdmin.from("lzt_sales").insert({
      lzt_item_id: String(itemId),
      buy_price: buyPriceBrl,
      sell_price: sellPriceBrl,
      profit: sellPriceBrl - buyPriceBrl,
      title: item.productName || `Conta ${gameLabel} #${itemId}`,
      game: lztGame,
      buyer_user_id: payment.user_id,
    });
    if (saleErr) console.error("Failed to record lzt_sale:", saleErr);
    else console.log("LZT sale recorded:", itemId);

  } catch (err: any) {
    console.error("LZT account purchase error:", err);
    await createManualDeliveryTicket(`Exception: ${err?.message || String(err)}`);
  }
}

// Robot Project purchase and delivery
async function fulfillRobotProduct(supabaseAdmin: any, payment: any, item: any, productData: any, planData: any) {
  const robotGameId = productData.robot_game_id;
  const duration = planData?.robot_duration_days || 30;

  log("INFO", "fulfillRobot", "Starting Robot fulfillment", { robotGameId, duration, product: item.productName, userId: payment.user_id });

  // Get Robot credentials
  const creds = await getRobotCredentials(supabaseAdmin);

  if (!creds) {
    console.error("Robot Project credentials not configured");
    // Create manual delivery ticket
    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: item.productId,
        product_plan_id: item.planId,
        stock_item_id: null,
        status: "open",
        status_label: "Entrega Manual",
        metadata: { type: "robot-project", robot_game_id: robotGameId, duration, error: "Credentials not configured" },
      })
      .select("id")
      .single();
    if (ticket) {
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: "✅ Pagamento confirmado! ⚠️ Houve um problema técnico. Nossa equipe irá entregar manualmente em breve.",
      });
    }
    return;
  }

  try {
    // Pre-check: fetch live provider status / price / balance before buy
    const robotSnapshot = await fetchRobotGameSnapshot(creds, robotGameId, duration);
    log("INFO", "fulfillRobot", "Pre-check", {
      gameId: robotGameId,
      gameName: robotSnapshot.game?.name || null,
      expectedPrice: robotSnapshot.expectedPrice,
      balance: robotSnapshot.balance,
      availableSlots: robotSnapshot.availableSlots,
      duration,
      reason: robotSnapshot.reason || null,
    });

    if (robotSnapshot.reason) {
      log("ERROR", "fulfillRobot", "Provider pre-check blocked auto-delivery", {
        robotGameId,
        duration,
        reason: robotSnapshot.reason,
      });
    }

    const buyRes = await fetch(`https://api.robotproject.com.br/buy/${encodeURIComponent(robotGameId)}`, {
      method: "POST",
      headers: {
        Authorization: robotAuthHeader(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duration: Number(duration) }),
    });

    const buyData = await buyRes.json();
    log("INFO", "fulfillRobot", "Robot buy response", { status: buyRes.status, body: JSON.stringify(buyData).substring(0, 500), expectedPrice: robotSnapshot.expectedPrice, duration });

    if (!buyRes.ok || !buyData.success) {
      const reason = buyData.message || `HTTP ${buyRes.status}`;
      log("ERROR", "fulfillRobot", "Robot buy failed", { reason, robotGameId, duration });

      const { data: ticket } = await supabaseAdmin
        .from("order_tickets")
        .insert({
          user_id: payment.user_id,
          product_id: item.productId,
          product_plan_id: item.planId,
          stock_item_id: null,
          status: "open",
          status_label: "Entrega Manual",
          metadata: { type: "robot-project", robot_game_id: robotGameId, duration, error: reason },
        })
        .select("id")
        .single();
      if (ticket) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message: `✅ Pagamento confirmado! ⚠️ Houve um erro ao gerar sua key automaticamente. Nossa equipe irá entregar em breve.`,
        });
      }

      // Alert admin via Discord about the failed delivery
      try {
        const { data: webhookCred } = await supabaseAdmin
          .from("system_credentials")
          .select("value")
          .eq("env_key", "DISCORD_WEBHOOK_URL")
          .maybeSingle();
        const wh = webhookCred?.value;
        if (wh) {
          await fetch(wh, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: "@everyone",
              embeds: [{
                title: "⚠️ Falha na entrega automática — Robot Project",
                color: 0xFF4444,
                fields: [
                  { name: "Produto", value: item.productName || "?", inline: true },
                  { name: "Plano", value: item.planName || "?", inline: true },
                  { name: "Erro", value: reason.substring(0, 200) },
                  { name: "Ticket", value: ticket?.id?.substring(0, 8).toUpperCase() || "—", inline: true },
                ],
                footer: { text: "Entrega manual necessária" },
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        }
      } catch (_) { /* ignore webhook errors */ }

      return;
    }

    // Success! Deliver the key
    // Robot API returns keys without dashes (e.g. "APIBF6A6FBEB89A8")
    // but they should be formatted as "APIB-F6A6-FBEB-89A8" (groups of 4)
    const rawKey = buyData.data?.key || "";
    const key = rawKey.length >= 8 && !rawKey.includes("-")
      ? rawKey.match(/.{1,4}/g)?.join("-") || rawKey
      : rawKey;
    const gameName = buyData.data?.gameName || item.productName || "";
    const amountSpent = buyData.data?.amountSpent || 0;
    const robotBalance = buyData.data?.balance ?? null;
    const isFreeGame = buyData.data?.game?.free === true || buyData.data?.finalAmount === 0;
    const downloadUrl = buyData.data?.game?.downloadUrl || buyData.data?.downloadUrl || null;
    const fileName = buyData.data?.game?.fileName || buyData.data?.fileName || null;

    // Store key as stock item
    const { data: stockItem } = await supabaseAdmin
      .from("stock_items")
      .insert({
        product_plan_id: item.planId,
        content: `Key: ${key}`,
        used: true,
        used_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    // Create delivered ticket
    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: item.productId,
        product_plan_id: item.planId,
        stock_item_id: stockItem?.id || null,
        status: "delivered",
        status_label: "Entregue",
        metadata: {
          type: "robot-project",
          robot_game_id: robotGameId,
          duration,
          key,
          amount_spent: amountSpent,
          game_name: gameName,
          robot_balance: robotBalance,
          is_free: isFreeGame,
          download_url: downloadUrl,
          file_name: fileName,
        },
      })
      .select("id")
      .single();

    if (ticket) {
      // Build delivery message
      let deliveryMsg = `✅ Seu produto foi entregue automaticamente!\n\n🔑 **Key:** \`${key}\`\n⏱️ Duração: ${duration} dias`;
      if (isFreeGame) {
        deliveryMsg = `✅ Produto gratuito ativado automaticamente!\n\n🔑 **Key:** \`${key}\``;
      }
      if (downloadUrl) {
        deliveryMsg += `\n\n📥 **Download:** ${downloadUrl}`;
        if (fileName) {
          deliveryMsg += `\n📄 Arquivo: ${fileName}`;
        }
      }
      deliveryMsg += `\n\nVeja a chave acima para ativar.`;

      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: deliveryMsg,
      });

      // Robot products: tutorial is shown via PedidoChat UI from product_tutorials table
      // No need to send tutorial as chat messages — admin configures it in the product settings
    }

    console.log(`Robot fulfillment success: key=${key}, game=${gameName}, spent=${amountSpent}, balance=${robotBalance}, free=${isFreeGame}`);

  } catch (err: any) {
    console.error("Robot fulfillment error:", err);
    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: item.productId,
        product_plan_id: item.planId,
        stock_item_id: null,
        status: "open",
        status_label: "Entrega Manual",
        metadata: { type: "robot-project", robot_game_id: robotGameId, duration, error: err?.message || String(err) },
      })
      .select("id")
      .single();
    if (ticket) {
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: "✅ Pagamento confirmado! ⚠️ Erro ao gerar key. Equipe irá entregar manualmente.",
      });
    }
  }
}

// ========== SERVER-SIDE PRICE VALIDATION ==========
async function validateAndCalculatePrice(
  supabaseAdmin: any,
  cartSnapshot: any[],
  userId: string,
  couponId: string | null
): Promise<{ validatedAmount: number; validatedDiscount: number; validatedCart: any[]; error?: string }> {
  if (!Array.isArray(cartSnapshot) || cartSnapshot.length === 0) {
    return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Carrinho vazio" };
  }

  let totalAmount = 0;
  const validatedCart: any[] = [];

  for (const item of cartSnapshot) {
    if (item.type === "raspadinha" || item.planId === "raspadinha") {
      const { data: scratchConfig } = await supabaseAdmin
        .from("scratch_card_config")
        .select("price, active")
        .limit(1)
        .single();
      if (!scratchConfig?.active) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Raspadinha indisponível" };
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const realPrice = Number(scratchConfig.price);
      totalAmount += realPrice * qty * 100;
      validatedCart.push({ ...item, price: realPrice, quantity: qty });
      continue;
    }

    if (item.type === "lzt-account") {
      const lztItemId = item.lztItemId;
      if (!lztItemId) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "ID da conta LZT não informado" };
      }

      // Fetch LZT token
      const { data: lztCredRow } = await supabaseAdmin
        .from("system_credentials")
        .select("value")
        .eq("env_key", "LZT_API_TOKEN")
        .maybeSingle();
      const lztToken = lztCredRow?.value || Deno.env.get("LZT_MARKET_TOKEN");
      if (!lztToken) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "LZT token não configurado" };
      }

      // Fetch current LZT price to calculate our COST (not the sale price)
      // The sale price is locked to what the customer saw (item.price)
      let lztRes: Response | null = null;
      const RETRYABLE = [429, 502, 503, 504];
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
        try {
          lztRes = await fetch(`https://api.lzt.market/${encodeURIComponent(lztItemId)}`, {
            headers: { Authorization: `Bearer ${lztToken}`, Accept: "application/json" },
          });
          if (lztRes.ok || !RETRYABLE.includes(lztRes.status)) break;
          console.warn(`LZT API attempt ${attempt + 1} for item ${lztItemId}: ${lztRes.status}, retrying...`);
        } catch (fetchErr) {
          console.warn(`LZT API fetch attempt ${attempt + 1} failed:`, fetchErr);
          lztRes = null;
        }
      }
      if (!lztRes || !lztRes.ok) {
        const status = lztRes?.status || "network error";
        console.error(`LZT API error for item ${lztItemId}: ${status} (after retries)`);
        const userMsg = status === 503 || status === "network error"
          ? "O serviço de contas está temporariamente indisponível. Tente novamente em alguns minutos."
          : `Erro ao verificar conta LZT ${lztItemId}`;
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: userMsg };
      }
      const lztData = await lztRes.json();
      const lztItem = lztData?.item;
      const realLztPrice = Number(lztItem?.price) || 0;
      const realLztCurrency = lztItem?.price_currency || "rub";

      // Check if item is still available for purchase
      // canBuyItem === false or buyer !== null means it's already sold
      const isSold = lztItem?.buyer != null || lztItem?.canBuyItem === false;
      if (realLztPrice <= 0 || isSold) {
        console.warn(`LZT item ${lztItemId} unavailable: price=${realLztPrice}, buyer=${lztItem?.buyer}, canBuyItem=${lztItem?.canBuyItem}`);
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Esta conta já foi vendida ou não está mais disponível. Por favor, escolha outra conta.` };
      }

      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .single();
      
      const gameCategory = item.lztGame || item.gameCategory || "";
      let markup = lztConfig?.markup_multiplier || 1.5;
      if (gameCategory === "valorant" && lztConfig?.markup_valorant) markup = lztConfig.markup_valorant;
      else if (gameCategory === "lol" && lztConfig?.markup_lol) markup = lztConfig.markup_lol;
      else if (gameCategory === "fortnite" && lztConfig?.markup_fortnite) markup = lztConfig.markup_fortnite;
      else if (gameCategory === "minecraft" && lztConfig?.markup_minecraft) markup = lztConfig.markup_minecraft;
      
      const RUB_TO_BRL = 0.055;
      const costBrl = realLztCurrency === "rub" ? realLztPrice * RUB_TO_BRL : realLztPrice;
      
      // The price the customer saw (sent from frontend)
      const clientDisplayPrice = Number(item.price) || 0;
      
      // Recalculate what the price SHOULD be now (for reference)
      const currentCalcPrice = Math.round(costBrl * markup * 100) / 100;
      const MIN_PRICE = 20;
      const currentFairPrice = currentCalcPrice < MIN_PRICE ? MIN_PRICE : currentCalcPrice;
      
      // PRICE LOCK STRATEGY:
      // - Use the price the customer saw (clientDisplayPrice) if it covers our cost
      // - If cost went up so much we'd lose money, reject the purchase
      // - If client didn't send a price, use current calculated price
      let finalPrice: number;
      
      if (clientDisplayPrice > 0) {
        // Check if we're still profitable: client price must be >= cost
        // Allow a small 5% tolerance for edge cases
        if (clientDisplayPrice < costBrl * 0.95) {
          console.error(`LZT PRICE LOCK REJECTED: clientPrice=${clientDisplayPrice}, cost=${costBrl.toFixed(2)}, would lose money`);
          return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "O preço desta conta mudou. Por favor, volte e tente novamente." };
        }
        // Lock to the price the customer saw
        finalPrice = clientDisplayPrice;
        console.log(`LZT PRICE LOCKED: itemId=${lztItemId}, lockedPrice=${finalPrice}, cost=${costBrl.toFixed(2)}, currentFair=${currentFairPrice}, margin=${((finalPrice - costBrl) / finalPrice * 100).toFixed(1)}%`);
      } else {
        // No client price sent — use current calculated price (backwards compat)
        finalPrice = currentFairPrice;
        console.log(`LZT PRICE CALCULATED (no lock): itemId=${lztItemId}, price=${finalPrice}, cost=${costBrl.toFixed(2)}`);
      }
      
      totalAmount += Math.round(finalPrice * 100);
      validatedCart.push({ ...item, price: finalPrice, lztPrice: realLztPrice, lztCurrency: realLztCurrency });
      continue;
    }

    const planId = item.planId;
    if (!planId) {
      return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Plano não especificado" };
    }

    const { data: plan } = await supabaseAdmin
      .from("product_plans")
      .select("id, price, active, product_id, robot_duration_days")
      .eq("id", planId)
      .single();

    if (!plan || !plan.active) {
      return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Plano ${planId} não encontrado ou inativo` };
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    let realPrice = Number(plan.price);

    // If price is 0 and product has robot markup, calculate from Robot API prices
    if (realPrice <= 0) {
      const { data: productData } = await supabaseAdmin
        .from("products")
        .select("robot_game_id, robot_markup_percent")
        .eq("id", plan.product_id)
        .maybeSingle();

      if (productData?.robot_game_id && productData.robot_markup_percent && plan.robot_duration_days) {
        // Fetch robot game prices to calculate
        const [uRes, pRes] = await Promise.all([
          supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_USERNAME").maybeSingle(),
          supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_PASSWORD").maybeSingle(),
        ]);
        const robotUsername = uRes.data?.value;
        const robotPassword = pRes.data?.value;
        if (robotUsername && robotPassword) {
          try {
            const auth = btoa(`${robotUsername}:${robotPassword}`);
            const gamesRes = await fetch("https://api.robotproject.com.br/games", {
              headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
            });
            if (gamesRes.ok) {
              const games = await gamesRes.json();
              const robotGame = Array.isArray(games) ? games.find((g: any) => g.id === productData.robot_game_id) : null;
              if (robotGame?.prices) {
                const basePriceUsd = robotGame.prices[String(plan.robot_duration_days)];
                if (basePriceUsd !== undefined && basePriceUsd > 0) {
                  // Robot API returns full price — apply reseller discount (-40%) first
                  const costPriceUsd = basePriceUsd * 0.6;
                  // Fetch live exchange rate
                  let usdToBrl = 5.25; // fallback
                  try {
                    const fxRes = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
                    if (fxRes.ok) {
                      const fxData = await fxRes.json();
                      const bid = Number(fxData?.USDBRL?.bid);
                      if (bid > 0) usdToBrl = bid;
                    }
                  } catch (_) { /* use fallback */ }
                  const basePriceBrl = costPriceUsd * usdToBrl;
                  realPrice = Number((basePriceBrl * (1 + productData.robot_markup_percent / 100)).toFixed(2));
                  console.log(`Robot markup price: fullUSD=${basePriceUsd}, costUSD=${costPriceUsd} (-40%), rate=${usdToBrl}, baseBRL=${basePriceBrl.toFixed(2)}, markup=${productData.robot_markup_percent}%, final=${realPrice}`);
                }
              }
            }
          } catch (err) {
            console.error("Failed to fetch robot prices for validation:", err);
          }
        }
      }

      if (realPrice <= 0) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Plano "${plan.id}" tem preço R$ 0. Configure o preço no painel admin.` };
      }
    }

    const { data: resellerData } = await supabaseAdmin
      .from("resellers")
      .select("id, discount_percent, active")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    if (resellerData) {
      // Check if reseller is authorized for this specific product
      const { data: resellerProduct } = await supabaseAdmin
        .from("reseller_products")
        .select("id")
        .eq("reseller_id", resellerData.id)
        .eq("product_id", plan.product_id)
        .maybeSingle();

      if (resellerProduct) {
        realPrice = realPrice * (1 - resellerData.discount_percent / 100);
      }
    }

    totalAmount += Math.round(realPrice * 100) * qty;
    validatedCart.push({ ...item, price: realPrice, quantity: qty });
  }

  let validatedDiscount = 0;
  if (couponId) {
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("id", couponId)
      .eq("active", true)
      .single();

    if (coupon) {
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        console.log("Coupon expired, ignoring");
      } else if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        console.log("Coupon max uses reached, ignoring");
      } else {
        const { data: usage } = await supabaseAdmin
          .from("coupon_usage")
          .select("id")
          .eq("coupon_id", couponId)
          .eq("user_id", userId)
          .maybeSingle();

        if (usage) {
          console.log("User already used this coupon, ignoring");
        } else {
          const totalInReais = totalAmount / 100;
          if (totalInReais >= (coupon.min_order_value || 0)) {
            if (coupon.discount_type === "percentage") {
              validatedDiscount = Math.round(totalAmount * (coupon.discount_value / 100));
            } else {
              validatedDiscount = Math.round(Number(coupon.discount_value) * 100);
            }
          }
        }
      }
    }
  }

  const finalAmount = Math.max(100, totalAmount - validatedDiscount);

  return {
    validatedAmount: finalAmount,
    validatedDiscount: validatedDiscount / 100,
    validatedCart,
  };
}

// ========== MISTICPAY HELPERS ==========
async function getMisticPayCredentials(supabaseAdmin: any): Promise<{ clientId: string; clientSecret: string } | null> {
  const [ciResult, csResult] = await Promise.all([
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "MISTICPAY_CLIENT_ID").maybeSingle(),
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "MISTICPAY_CLIENT_SECRET").maybeSingle(),
  ]);

  const clientId = ciResult.data?.value || Deno.env.get("MISTICPAY_CLIENT_ID");
  const clientSecret = csResult.data?.value || Deno.env.get("MISTICPAY_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function misticPayHeaders(creds: { clientId: string; clientSecret: string }) {
  return {
    "ci": creds.clientId,
    "cs": creds.clientSecret,
    "Content-Type": "application/json",
  };
}

function mapMisticPayStatus(state: string): string {
  switch (state?.toUpperCase()) {
    case "COMPLETO": return "COMPLETED";
    case "FALHA": return "FAILED";
    case "PENDENTE": return "ACTIVE";
    default: return "ACTIVE";
  }
}

// In-memory throttle map for status polling (per-isolate)
const statusPollMap = new Map<string, number>();

// In-memory rate limiter per IP (general requests)
const ipRequestMap = new Map<string, { count: number; windowStart: number }>();
// In-memory rate limiter per user (general requests)
const userRequestMap = new Map<string, { count: number; windowStart: number }>();
// In-memory duplicate payment prevention (userId -> last create timestamp)
const lastPaymentCreateMap = new Map<string, number>();

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

// Anti-bot: check user-agent
function isBlockedBot(req: Request): boolean {
  const ua = req.headers.get("user-agent") || "";
  if (!ua || ua.length < 5) return true;
  const blocked = ["python-requests", "curl/", "wget/", "httpie/", "postman", "insomnia", "scrapy", "go-http-client"];
  const lower = ua.toLowerCase();
  return blocked.some(b => lower.includes(b));
}

// General rate limiter (per minute)
function checkRateLimit(key: string, map: Map<string, { count: number; windowStart: number }>, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now - entry.windowStart > 60_000) {
    map.set(key, { count: 1, windowStart: now });
    return false; // not limited
  }
  entry.count++;
  if (entry.count > maxPerMinute) return true; // limited
  return false;
}

// Cleanup old entries from maps periodically
function cleanupMap(map: Map<string, any>, maxSize: number) {
  if (map.size > maxSize) {
    const cutoff = Date.now() - 120_000;
    for (const [k, v] of map) {
      const ts = typeof v === "number" ? v : v?.windowStart || 0;
      if (ts < cutoff) map.delete(k);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const clientIp = getClientIp(req);

  // ==================== ANTI-BOT CHECK ====================
  // Skip for webhooks (server-to-server)
  if (action !== "webhook" && isBlockedBot(req)) {
    console.error(`BOT BLOCKED: IP=${clientIp}, UA="${req.headers.get("user-agent")}", action=${action}`);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ==================== GENERAL IP RATE LIMIT (60/min) ====================
  if (action !== "webhook") {
    if (checkRateLimit(clientIp, ipRequestMap, 60)) {
      console.error(`IP RATE LIMIT: IP=${clientIp}, action=${action}`);
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    cleanupMap(ipRequestMap, 2000);
  }

  // ==================== MISTICPAY WEBHOOK (no auth required) ====================
  if (action === "webhook" && req.method === "POST") {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const body = await req.json();
      console.log("MisticPay webhook received:", JSON.stringify(body).substring(0, 500));

      // MisticPay sends transactionId and transactionState
      const txId = body.transactionId || body.transaction?.transactionId;
      const txState = body.transactionState || body.transaction?.transactionState || body.status;

      if (!txId) {
        console.error("Webhook missing transactionId");
        return new Response(JSON.stringify({ error: "Missing transactionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate webhook credentials (mandatory)
      const misticCreds = await getMisticPayCredentials(supabaseAdmin);
      if (!misticCreds || !misticCreds.clientId || !misticCreds.clientSecret) {
        console.error("Webhook rejected: MisticPay credentials not configured");
        return new Response(JSON.stringify({ error: "Server misconfigured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webhookCi = req.headers.get("ci") || body.ci;
      const webhookCs = req.headers.get("cs") || body.cs;

      if (!webhookCi || !webhookCs || webhookCi !== misticCreds.clientId || webhookCs !== misticCreds.clientSecret) {
        console.error("Webhook credentials invalid or missing. IP:", req.headers.get("x-forwarded-for") || "unknown");
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replay prevention: reject webhooks with timestamps older than 5 minutes
      const webhookTimestamp = body.timestamp || body.createdAt;
      if (webhookTimestamp) {
        const webhookTime = new Date(webhookTimestamp).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (!isNaN(webhookTime) && Math.abs(now - webhookTime) > fiveMinutes) {
          console.error("Webhook rejected: timestamp too old/future", webhookTimestamp);
          return new Response(JSON.stringify({ error: "Stale webhook" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.log("Webhook authenticated successfully for txId:", txId);

      // Find payment by charge_id (MisticPay transactionId)
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("charge_id", String(txId))
        .maybeSingle();

      if (!payment) {
        console.error("Webhook: payment not found for txId:", txId);
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (payment.status === "COMPLETED") {
        console.log("Webhook: payment already completed:", payment.id);
        return new Response(JSON.stringify({ success: true, message: "Already completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStatus = mapMisticPayStatus(txState);
      log("INFO", "webhook", "Status transition", { paymentId: payment.id, from: payment.status, to: newStatus, txId, userId: payment.user_id });

      if (newStatus !== payment.status) {
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === "COMPLETED") {
          updates.paid_at = body.updatedAt || body.transaction?.updatedAt || new Date().toISOString();
        }

        const { data: updatedPayment } = await supabaseAdmin
          .from("payments")
          .update(updates)
          .eq("id", payment.id)
          .eq("status", payment.status)
          .select("id")
          .maybeSingle();

        if (newStatus === "COMPLETED" && updatedPayment) {
          log("INFO", "webhook", "Fulfilling completed payment", { paymentId: payment.id, userId: payment.user_id, amount: payment.amount });
          await fulfillOrder(supabaseAdmin, payment);
          await sendDiscordSaleNotification(supabaseAdmin, payment);
          await sendServerPurchaseEvent(payment, req);
          await assignDiscordClientRole(supabaseAdmin, payment.user_id);
        }
      }

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response(JSON.stringify({ error: "Webhook processing error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Auth check for all other actions
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const supabaseUser = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  console.log("Auth result:", { userId: claimsData?.claims?.sub, error: claimsError?.message, authHeader: authHeader?.substring(0, 30) });
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized", detail: claimsError?.message || "Auth session missing!" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ==================== USER RATE LIMIT (20/min) ====================
  if (checkRateLimit(userId, userRequestMap, 20)) {
    console.error(`USER RATE LIMIT: userId=${userId}, IP=${clientIp}, action=${action}`);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  cleanupMap(userRequestMap, 2000);

  try {
    // ==================== BAN CHECK ====================
    {
      const { data: banProfile } = await supabaseAdmin
        .from("profiles")
        .select("banned")
        .eq("user_id", userId)
        .maybeSingle();
      if (banProfile?.banned) {
        return new Response(JSON.stringify({ error: "Sua conta está suspensa. Entre em contato com o suporte." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ==================== RATE LIMITING (payment creation) ====================
    if (["create", "create-card", "create-crypto"].includes(action || "") && req.method === "POST") {
      // Check duplicate payment creation (30s cooldown)
      const lastCreate = lastPaymentCreateMap.get(userId);
      const now = Date.now();
      if (lastCreate && now - lastCreate < 30_000) {
        console.error(`DUPLICATE PAYMENT BLOCKED: userId=${userId}, IP=${clientIp}, elapsed=${now - lastCreate}ms`);
        return new Response(JSON.stringify({ error: "Aguarde 30 segundos antes de criar outro pagamento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-expire stale ACTIVE payments older than 30 minutes
      await supabaseAdmin
        .from("payments")
        .update({ status: "EXPIRED" })
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      // Check active payments per user (max 5)
      const { count: activeCount } = await supabaseAdmin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "ACTIVE");

      if ((activeCount ?? 0) >= 5) {
        console.error(`RATE LIMIT: user ${userId} has ${activeCount} active payments. IP: ${clientIp}`);
        return new Response(JSON.stringify({ error: "Você tem muitos pagamentos pendentes. Aguarde a expiração ou conclusão dos pagamentos anteriores." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ==================== STATUS POLLING THROTTLE ====================
    if ((action === "status" || action === "card-status" || action === "crypto-status") && req.method === "GET") {
      const now = Date.now();
      const lastPoll = statusPollMap.get(userId);
      if (lastPoll && now - lastPoll < 3000) {
        return new Response(JSON.stringify({ error: "Aguarde alguns segundos antes de verificar novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      statusPollMap.set(userId, now);
      // Cleanup old entries periodically
      if (statusPollMap.size > 5000) {
        const cutoff = now - 30000;
        for (const [k, v] of statusPollMap) {
          if (v < cutoff) statusPollMap.delete(k);
        }
      }
    }

    // ==================== CREATE PIX CHARGE (MisticPay) ====================
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { cart_snapshot, coupon_id } = body;

      // Run credentials fetch, price validation, and profile fetch in PARALLEL
      const [misticCreds, validationResult, profileResult] = await Promise.all([
        getMisticPayCredentials(supabaseAdmin),
        validateAndCalculatePrice(supabaseAdmin, cart_snapshot, userId, coupon_id),
        supabaseAdmin.from("profiles").select("username").eq("user_id", userId).maybeSingle(),
      ]);

      if (!misticCreds) {
        return new Response(JSON.stringify({ error: "MisticPay credentials not configured (MISTICPAY_CLIENT_ID / MISTICPAY_CLIENT_SECRET)" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { validatedAmount, validatedDiscount, validatedCart, error: validationError } = validationResult;

      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountCents = validatedAmount;
      const amountReais = amountCents / 100;
      const profile = profileResult.data;

      const internalTxId = crypto.randomUUID();

      const mpRes = await fetch(`${MISTICPAY_BASE_URL}/transactions/create`, {
        method: "POST",
        headers: misticPayHeaders(misticCreds),
        body: JSON.stringify({
          amount: amountReais,
          payerName: profile?.username || "Cliente",
          payerDocument: "00000000000", // placeholder - MisticPay requires CPF
          transactionId: internalTxId,
          description: `Compra Royal Store - ${validatedCart.length} item(s)`,
        }),
      });

      const mpData = await mpRes.json();
      console.log("MisticPay create response:", mpRes.status, JSON.stringify(mpData).substring(0, 500));

      if (!mpRes.ok || !mpData.data) {
        console.error("MisticPay error:", mpData);
        return new Response(JSON.stringify({ error: mpData.message || "Erro ao criar cobrança PIX" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chargeData = mpData.data;
      const misticPayTxId = String(chargeData.transactionId);

      const { data: payment, error: insertError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          charge_id: misticPayTxId,
          external_id: internalTxId,
          amount: amountCents,
          status: "ACTIVE",
          cart_snapshot: validatedCart,
          coupon_id: coupon_id || null,
          discount_amount: validatedDiscount,
          payment_method: "pix",
        })
        .select("id")
        .single();

      if (insertError) {
        // Don't set lastPaymentCreateMap on error
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record successful creation for duplicate prevention
      lastPaymentCreateMap.set(userId, Date.now());
      cleanupMap(lastPaymentCreateMap, 2000);

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          validated_amount: amountReais,
          validated_discount: validatedDiscount,
          charge: {
            id: misticPayTxId,
            brCode: chargeData.copyPaste,
            qrCodeImage: chargeData.qrCodeBase64 || chargeData.qrcodeUrl,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min expiry
          },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== CHECK PIX STATUS (MisticPay) ====================
    if (action === "status" && req.method === "GET") {
      const paymentId = url.searchParams.get("payment_id");
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", userId)
        .single();

      if (!payment) {
        return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (payment.status === "COMPLETED") {
        return new Response(JSON.stringify({ success: true, status: "COMPLETED" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check on MisticPay
      const misticCreds = await getMisticPayCredentials(supabaseAdmin);
      if (misticCreds && payment.charge_id) {
        const mpRes = await fetch(`${MISTICPAY_BASE_URL}/transactions/check`, {
          method: "POST",
          headers: misticPayHeaders(misticCreds),
          body: JSON.stringify({ transactionId: payment.charge_id }),
        });

        const mpData = await mpRes.json();
        if (mpRes.ok && mpData.transaction) {
          const newStatus = mapMisticPayStatus(mpData.transaction.transactionState);

          if (newStatus !== payment.status) {
            const updates: Record<string, unknown> = { status: newStatus };
            if (newStatus === "COMPLETED") {
              updates.paid_at = mpData.transaction.updatedAt || new Date().toISOString();
            }
            const { data: updatedPayment } = await supabaseAdmin
              .from("payments")
              .update(updates)
              .eq("id", paymentId)
              .eq("status", payment.status)
              .select("id")
              .maybeSingle();

            if (newStatus === "COMPLETED" && updatedPayment) {
              await fulfillOrder(supabaseAdmin, payment);
              await sendDiscordSaleNotification(supabaseAdmin, payment);
              await sendServerPurchaseEvent(payment, req);
              await assignDiscordClientRole(supabaseAdmin, payment.user_id);
            }
          }

          return new Response(JSON.stringify({ success: true, status: newStatus }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== FORCE COMPLETE (admin-only) ====================
    if (action === "force-complete" && req.method === "POST") {
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { payment_id } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", payment_id)
        .single();

      if (!payment) {
        return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (payment.status === "COMPLETED") {
        return new Response(JSON.stringify({ success: true, status: "COMPLETED", message: "Já foi aprovado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updatedPayment } = await supabaseAdmin
        .from("payments")
        .update({
          status: "COMPLETED",
          paid_at: new Date().toISOString(),
        })
        .eq("id", payment_id)
        .eq("status", payment.status)
        .select("id")
        .maybeSingle();

      if (updatedPayment) {
        await fulfillOrder(supabaseAdmin, payment);
        await sendDiscordSaleNotification(supabaseAdmin, payment);
        await sendServerPurchaseEvent(payment, req);
        await assignDiscordClientRole(supabaseAdmin, payment.user_id);
      }

      return new Response(
        JSON.stringify({ success: true, status: "COMPLETED", message: "Pagamento validado e produtos entregues" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== CARD / CRYPTO — NOT SUPPORTED ====================
    if (action === "create-card" || action === "card-status" || action === "create-crypto" || action === "crypto-status") {
      return new Response(JSON.stringify({ error: "Método de pagamento não disponível com a gateway atual (MisticPay). Apenas PIX é suportado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
