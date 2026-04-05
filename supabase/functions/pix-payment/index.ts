import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  CartSnapshotItem,
  PaymentRow,
  RobotPlanRow,
  RobotProductRow,
  SupabaseAdminClient,
} from "../_shared/types.ts";
import { errorMessage } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MISTICPAY_BASE_URL = "https://api.misticpay.com/api";

// ─── Live exchange rate helper ────────────────────────────────────────────────
const FALLBACK_RUB_TO_BRL = 0.055;
const FALLBACK_USD_TO_BRL = 6.10;
let cachedRates: { rub: number; usd: number; fetchedAt: number } | null = null;

async function getLiveRates(): Promise<{ rub: number; usd: number }> {
  // Cache for 10 minutes to avoid hammering the API during fulfillment bursts
  if (cachedRates && Date.now() - cachedRates.fetchedAt < 10 * 60 * 1000) {
    return { rub: cachedRates.rub, usd: cachedRates.usd };
  }
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,RUB-BRL");
    if (res.ok) {
      const data = await res.json();
      const usd = Number(data?.USDBRL?.bid) || FALLBACK_USD_TO_BRL;
      const rub = Number(data?.RUBBRL?.bid) || FALLBACK_RUB_TO_BRL;
      cachedRates = { rub, usd, fetchedAt: Date.now() };
      return { rub, usd };
    }
  } catch (_) { /* use fallback */ }
  return { rub: FALLBACK_RUB_TO_BRL, usd: FALLBACK_USD_TO_BRL };
}

// ─── Structured Logger ────────────────────────────────────────────────────────
function log(level: "INFO" | "WARN" | "ERROR", ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, ctx, msg, ...(data || {}) };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

type RobotCredentials = { username: string; password: string };

interface RobotGameApiRow {
  id?: unknown;
  prices?: Record<string, unknown>;
  maxKeys?: unknown;
  soldKeys?: unknown;
  status?: unknown;
  is_free?: boolean;
  isFree?: boolean;
  name?: unknown;
}

type RobotGameSnapshot = {
  game: RobotGameApiRow | null;
  balance: number | null;
  expectedPrice: number | null;
  availableSlots: number | null;
  reason?: string;
};

async function getRobotCredentials(supabaseAdmin: SupabaseAdminClient): Promise<RobotCredentials | null> {
  const [uRes, pRes] = await Promise.all([
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_USERNAME").maybeSingle(),
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_PASSWORD").maybeSingle(),
  ]);

  const username = uRes.data?.value || Deno.env.get("ROBOT_API_USERNAME");
  const password = pRes.data?.value || Deno.env.get("ROBOT_API_PASSWORD");
  if (!username || !password) return null;

  return { username, password };
}

/**
 * Token da API Lolzteam Market: coluna `LZT_API_TOKEN` (migração recente) ou `LZT_MARKET_TOKEN` (seed legado),
 * depois segredo `LZT_MARKET_TOKEN` na Edge Function.
 */
async function getLztMarketToken(supabaseAdmin: SupabaseAdminClient): Promise<string | null> {
  const { data: rows } = await supabaseAdmin
    .from("system_credentials")
    .select("env_key, value")
    .in("env_key", ["LZT_API_TOKEN", "LZT_MARKET_TOKEN"]);

  const byKey = new Map<string, string>();
  for (const r of rows || []) {
    const k = String((r as { env_key?: string }).env_key || "");
    const v = String((r as { value?: string }).value || "").trim();
    if (k && v) byKey.set(k, v);
  }

  const api = byKey.get("LZT_API_TOKEN");
  if (api) return api;
  const legacy = byKey.get("LZT_MARKET_TOKEN");
  if (legacy) return legacy;

  return (
    Deno.env.get("LZT_MARKET_TOKEN")?.trim() ||
    Deno.env.get("LZT_API_TOKEN")?.trim() ||
    null
  );
}

function robotAuthHeader(creds: RobotCredentials) {
  return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
}

/** Loader URL / filename from Robot GET /games or buy payload (field names vary — see Robot API docs). */
function robotGameDownloadFields(game: Record<string, unknown> | null | undefined): { downloadUrl: string | null; fileName: string | null } {
  if (!game || typeof game !== "object") return { downloadUrl: null, fileName: null };
  const g = game as Record<string, unknown>;
  const downloadUrl = [
    g.downloadUrl,
    g.download_url,
    g.loaderUrl,
    g.loader_url,
    g.downloadLink,
    g.download_link,
    g.programUrl,
    g.program_url,
    g.loaderDownload,
    g.loader_download,
    g.loaderLink,
    g.loader_link,
    g.fileUrl,
    g.file_url,
  ].find((v) => typeof v === "string" && (v as string).trim().length > 0) as string | undefined;
  const fileName = [
    g.fileName,
    g.file_name,
    g.loaderFileName,
    g.loader_file_name,
    g.programName,
    g.program_name,
  ].find((v) => typeof v === "string" && (v as string).trim().length > 0) as string | undefined;
  return {
    downloadUrl: downloadUrl?.trim() || null,
    fileName: fileName?.trim() || null,
  };
}

function robotGameIsFreeFlag(game: Record<string, unknown> | null | undefined): boolean {
  if (!game || typeof game !== "object") return false;
  return game.is_free === true || game.isFree === true;
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
  const rawGame = games.find((g: Record<string, unknown>) => Number(g["id"]) === Number(robotGameId));
  const game: RobotGameApiRow | null = rawGame ? (rawGame as RobotGameApiRow) : null;
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

  const gameIsFree = game.is_free === true || game.isFree === true;
  if (!gameIsFree && (expectedPrice === null || expectedPrice <= 0)) {
    return {
      game,
      balance,
      expectedPrice,
      availableSlots,
      reason: `A duração de ${duration} dia(s) não está disponível na Robot API.`,
    };
  }

  if (!gameIsFree && availableSlots !== null && availableSlots <= 0) {
    return { game, balance, expectedPrice, availableSlots, reason: "Sem slots disponíveis no provedor no momento." };
  }

  if (!gameIsFree && balance !== null && expectedPrice !== null && balance < expectedPrice) {
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

// SHA-256 hash helper for server-side PII hashing
async function sha256Hash(message: string | null | undefined): Promise<string> {
  if (!message) return "";
  try {
    const clean = message.trim().toLowerCase();
    const msgBuffer = new TextEncoder().encode(clean);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

async function sendServerPurchaseEvent(supabaseAdmin: SupabaseAdminClient, payment: PaymentRow, req: Request) {
  try {
    const { data: capiTokenRow } = await supabaseAdmin
      .from("system_credentials")
      .select("value")
      .eq("env_key", "META_ACCESS_TOKEN")
      .maybeSingle();

    const { data: pixelIdRow } = await supabaseAdmin
      .from("system_credentials")
      .select("value")
      .eq("env_key", "META_PIXEL_ID")
      .maybeSingle();

    const accessToken =
      String(capiTokenRow?.value || "").trim() || Deno.env.get("META_ACCESS_TOKEN")?.trim() || "";
    const pixelId =
      String(pixelIdRow?.value || "").trim() || Deno.env.get("META_PIXEL_ID")?.trim() || "";

    if (!accessToken || !pixelId) {
      console.warn("CAPI Purchase skipped: set META_ACCESS_TOKEN and META_PIXEL_ID in system_credentials or Edge secrets.");
      return;
    }

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

    // 1. Identity data (em, ph, fbp, fbc, external_id)
    const browserData = (payment.meta_tracking || {}) as Record<string, string>;
    const customerData = (payment.customer_data || {}) as Record<string, string>;
    const userData: Record<string, string> = {};

    // Priority: browserData (meta_tracking) > customerData (payment table)
    const email = browserData.em || customerData.email;
    const rawPhone = browserData.ph || customerData.phone;
    
    userData.em = await sha256Hash(email);
    
    let phone = rawPhone ? String(rawPhone).replace(/\D/g, "") : "";
    if (phone && !phone.startsWith("55") && phone.length >= 10) phone = "55" + phone;
    userData.ph = await sha256Hash(phone);
    
    if (browserData.fbp) userData.fbp = browserData.fbp;
    if (browserData.fbc) userData.fbc = browserData.fbc;
    if (browserData.external_id) userData.external_id = browserData.external_id;
    if (browserData.fn) userData.fn = browserData.fn;
    if (browserData.ln) userData.ln = browserData.ln;
    if (browserData.country) userData.country = browserData.country;
    if (browserData.client_user_agent) userData.client_user_agent = browserData.client_user_agent;

    // 2. Extra fallbacks from customer_data naming
    if (!userData.fn && customerData.name) {
      const firstName = customerData.name.split(" ")[0];
      if (firstName) userData.fn = await sha256Hash(firstName);
    }
    if (!userData.ln && customerData.name) {
      const lastName = customerData.name.split(" ").slice(1).join(" ");
      if (lastName) userData.ln = await sha256Hash(lastName);
    }
    if (!userData.external_id && payment.user_id) {
      userData.external_id = await sha256Hash(payment.user_id);
    }
    // Always ensure country is set
    if (!userData.country) {
      userData.country = await sha256Hash("br");
    }
    
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") || undefined;

    // 3. Server-side enrichment (always override IP for accuracy)
    if (clientIp) userData.client_ip_address = clientIp;
    // Fallback user agent from request if browser didn't provide one
    if (!userData.client_user_agent) {
      const ua = req.headers.get("user-agent");
      if (ua) userData.client_user_agent = ua;
    }

    const contentIds = cartItems.map((i) => i.productId);

    const eventData = {
      event_name: "Purchase",
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: browserData.event_source_url || req.headers.get("referer") || "https://royalstorebr.com/",
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

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${accessToken}`;

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
async function sendDiscordSaleNotification(supabaseAdmin: SupabaseAdminClient, payment: PaymentRow) {
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
async function assignDiscordClientRole(supabaseAdmin: SupabaseAdminClient, userId: string) {
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

    const guildId = creds?.find((c: { env_key?: string; value?: string }) => c.env_key === "DISCORD_GUILD_ID")?.value;
    const roleId = creds?.find((c: { env_key?: string; value?: string }) => c.env_key === "DISCORD_CLIENT_ROLE_ID")?.value;

    if (!guildId || !roleId) {
      console.log("Discord Guild/Role IDs not configured, skipping role assignment");
      return;
    }

    // Get user's Discord identity from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const identities = authUser?.user?.identities || [];
    const discordIdentity = identities.find((i: { provider?: string }) => i.provider === "discord");

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
async function fulfillOrder(supabaseAdmin: SupabaseAdminClient, payment: PaymentRow) {
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
    resellerProductIds = (rProducts || []).map((rp: { product_id: string }) => rp.product_id);
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
        await fulfillRobotProduct(
          supabaseAdmin,
          payment,
          item,
          productData as RobotProductRow,
          planData as RobotPlanRow | null,
        );
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
async function fulfillLztAccount(supabaseAdmin: SupabaseAdminClient, payment: PaymentRow, item: CartSnapshotItem) {
  const LZT_TOKEN = await getLztMarketToken(supabaseAdmin);

  const itemId = item.lztItemId;
  let price = item.lztPrice;
  let currency = item.lztCurrency || "rub";

  const lztGame = item.lztGame || "valorant";

  // ─── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
  // Check if we already have a successful ticket for this specific LZT item
  // associated with this user. This prevents double-purchases if the script
  // is triggered twice (e.g. webhook retry + manual status polling).
  const { data: existingTicket } = await supabaseAdmin
    .from("order_tickets")
    .select("id, status")
    .eq("user_id", payment.user_id)
    .eq("metadata->>lzt_item_id", String(itemId))
    .neq("status", "failed")
    .maybeSingle();

  if (existingTicket && existingTicket.status === "delivered") {
    console.log(`LZT item ${itemId} already delivered for user ${payment.user_id}. Skipping duplicate fulfillment.`);
    return;
  }

  const findProductAndPlan = async () => {
    let productId: string | null = null;
    let planId: string | null = null;
    // ... (rest of findProductAndPlan)


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
      const { data: lastResortProduct } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("active", true)
        .limit(1)
        .single();
      productId = lastResortProduct?.id || null;
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
    const ratesMd = await getLiveRates();
    const buyPriceMd = currency === "rub" ? Number(price || 0) * ratesMd.rub : currency === "usd" ? Number(price || 0) * ratesMd.usd : Number(price || 0);
    const sellPriceMd = Number(item.price) || 0;
    await supabaseAdmin.from("lzt_sales").insert({
      lzt_item_id: String(itemId),
      buy_price: buyPriceMd,
      sell_price: sellPriceMd,
      profit: sellPriceMd - buyPriceMd,
      title: item.productName || `Conta ${gameLabelManual} #${itemId}`,
      game: lztGame,
      buyer_user_id: payment.user_id,
    }).then(({ error: saleErr }: { error: unknown }) => {
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
      const detailCt = detailRes.headers.get("content-type") || "";
      if (detailRes.ok && detailCt.includes("application/json")) {
        const detailData = await detailRes.json();
        price = detailData.item?.price;
        currency = detailData.item?.price_currency || currency;
        console.log(`Got price: ${price} ${currency}`);
      } else {
        console.warn(`LZT price fetch returned non-JSON (${detailRes.status})`);
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
    const checkCt = checkRes.headers.get("content-type") || "";
    if (checkRes.ok && checkCt.includes("application/json")) {
      let checkData: Record<string, unknown> | null = null;
      try { checkData = await checkRes.json(); } catch { /* ignore */ }
      const checkItem = (checkData?.item ?? null) as Record<string, unknown> | null;
      const checkState = checkItem?.item_state;
      if (checkItem?.buyer || (checkState && checkState !== "active")) {
        console.error(`LZT item ${itemId} already sold (buyer=${checkItem.buyer}, state=${checkState})`);
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
        price = checkItem.price as number;
        currency = (checkItem.price_currency as string) || currency;
      }
    } else {
      console.warn(`LZT pre-check returned non-JSON or error (${checkRes.status}), proceeding anyway`);
    }
  } catch (err) {
    console.warn("Pre-check failed, proceeding with purchase anyway:", err);
  }

  console.log(`Purchasing LZT account ${itemId} at price ${price} ${currency}`);

  try {
    const buyUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;

    // Retry fast-buy up to 4 times with exponential backoff
    // LZT API returns 403 "retry_request" as a temporary rate-limit signal
    // LZT may also return HTML (Cloudflare challenge) instead of JSON — treat as retryable
    const RETRYABLE_BUY_STATUSES = [403, 429, 502, 503, 504];
    let buyRes: Response | null = null;
    let buyData: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.log(`LZT fast-buy retry attempt ${attempt + 1} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
      buyRes = await fetch(buyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LZT_TOKEN}`,
          Accept: "application/json",
        },
      });

      // Safely parse JSON — LZT may return HTML (Cloudflare challenge/error page)
      const contentType = buyRes.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const bodyPreview = await buyRes.text().then(t => t.substring(0, 200));
        console.warn(`LZT fast-buy attempt ${attempt + 1}: non-JSON response (${contentType}): ${bodyPreview}`);
        buyData = null;
        // Treat HTML/non-JSON responses as retryable
        if (attempt < 3) continue;
        break;
      }

      try {
        buyData = await buyRes.json();
      } catch {
        console.warn(`LZT fast-buy attempt ${attempt + 1}: JSON parse failed`);
        buyData = null;
        if (attempt < 3) continue;
        break;
      }

      console.log(`LZT fast-buy attempt ${attempt + 1}: ${buyRes.status}`, JSON.stringify(buyData).substring(0, 500));

      // If success or non-retryable error, stop
      if (buyRes.ok) break;

      // Check if this is a retryable error (retry_request or server error)
      const isRetryableStatus = RETRYABLE_BUY_STATUSES.includes(buyRes.status);
      const isRetryableError = Array.isArray(buyData?.errors) &&
        (buyData.errors as unknown[]).some((e) => typeof e === "string" && (e === "retry_request" || e.includes("retry")));
      if (!isRetryableStatus && !isRetryableError) break; // non-retryable, stop
    }

    if (!buyRes || !buyRes.ok || !buyData) {
      const reason = buyData
        ? `HTTP ${buyRes?.status || 0}: ${JSON.stringify(buyData).substring(0, 300)}`
        : `HTTP ${buyRes?.status || 0}: LZT returned non-JSON response (Cloudflare/HTML) after all retries`;
      console.error("LZT fast-buy failed after retries:", reason);
      await createManualDeliveryTicket(reason);
      return;
    }

    const boughtItem = buyData.item as Record<string, unknown> | undefined;
    const loginData = boughtItem?.loginData as Record<string, unknown> | undefined;
    const str = (v: unknown) => (typeof v === "string" ? v : "");

    let email = str(loginData?.login) || str(loginData?.email) || str(boughtItem?.email) || "";
    let password = str(loginData?.password) || str(boughtItem?.password) || "";
    const rawCredentials = str(loginData?.raw);
    let accountEmail: unknown =
      boughtItem?.emailLoginData ?? loginData?.emailLoginData ?? loginData?.email ?? boughtItem?.email ?? "";

    if (!email && rawCredentials) {
      const parts = rawCredentials.split(":");
      if (parts.length >= 2) {
        email = parts[0];
        password = parts.slice(1).join(":");
      }
    }

    if (typeof accountEmail === "string" && accountEmail === email && boughtItem?.item_origin === "autoreg") {
      accountEmail = boughtItem?.emailLoginData ?? boughtItem?.email ?? loginData?.email ?? "";
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

    const ratesFulfill = await getLiveRates();
    const buyPriceBrl = currency === "rub" ? Number(price) * ratesFulfill.rub : currency === "usd" ? Number(price) * ratesFulfill.usd : Number(price);
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

  } catch (err: unknown) {
    console.error("LZT account purchase error:", err);
    await createManualDeliveryTicket(`Exception: ${errorMessage(err)}`);
  }
}

// Robot Project purchase and delivery
async function fulfillRobotProduct(
  supabaseAdmin: SupabaseAdminClient,
  payment: PaymentRow,
  item: CartSnapshotItem,
  productData: RobotProductRow,
  planData: RobotPlanRow | null,
) {
  const robotGameId = Number(productData.robot_game_id);
  if (!Number.isFinite(robotGameId) || robotGameId <= 0) {
    log("ERROR", "fulfillRobot", "Invalid robot_game_id", { productId: productData.id });
    return;
  }
  const duration = planData?.robot_duration_days ?? 30;

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

      // CRITICAL: Do NOT proceed to buy — create manual delivery ticket instead
      const { data: ticket } = await supabaseAdmin
        .from("order_tickets")
        .insert({
          user_id: payment.user_id,
          product_id: item.productId,
          product_plan_id: item.planId,
          stock_item_id: null,
          status: "open",
          status_label: "Entrega Manual",
          metadata: { type: "robot-project", robot_game_id: robotGameId, duration, error: robotSnapshot.reason },
        })
        .select("id")
        .single();
      if (ticket) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message: `✅ Pagamento confirmado! ⚠️ ${robotSnapshot.reason} Nossa equipe irá entregar manualmente em breve.`,
        });
      }

      // Alert admin via Discord
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
                title: "⚠️ Robot pre-check bloqueou entrega automática",
                color: 0xFF8800,
                fields: [
                  { name: "Produto", value: item.productName || "?", inline: true },
                  { name: "Plano", value: item.planName || "?", inline: true },
                  { name: "Motivo", value: robotSnapshot.reason.substring(0, 200) },
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

    const snapDl = robotGameDownloadFields(robotSnapshot.game);
    const snapshotGameFree = robotGameIsFreeFlag(robotSnapshot.game);

    // Jogos is_free (API Robot): não retornam mais chaves (ex.: prefixo APIF-*). Entrega = apenas link do loader;
    // o cliente cria conta no loader e entra sem ativação por key. Nunca chamar POST /buy para is_free.
    if (snapshotGameFree) {
      let freeDownloadUrl = snapDl.downloadUrl;
      const freeFileName = snapDl.fileName;

      if (!freeDownloadUrl) {
        const { data: tutorialRow } = await supabaseAdmin
          .from("product_tutorials")
          .select("tutorial_file_url")
          .eq("product_id", item.productId)
          .maybeSingle();
        const tu = tutorialRow?.tutorial_file_url;
        if (typeof tu === "string") {
          const t = tu.trim();
          if (t.startsWith("http://") || t.startsWith("https://")) {
            freeDownloadUrl = t;
          }
        }
      }

      if (freeDownloadUrl) {
        log("INFO", "fulfillRobot", "Free game: skip Robot /buy, loader-only delivery", {
          robotGameId,
          duration,
          source: snapDl.downloadUrl ? "robot_api" : "product_tutorial",
        });
        const { data: ticket } = await supabaseAdmin
          .from("order_tickets")
          .insert({
            user_id: payment.user_id,
            product_id: item.productId,
            product_plan_id: item.planId,
            stock_item_id: null,
            status: "delivered",
            status_label: "Entregue",
            metadata: {
              type: "robot-project",
              robot_game_id: robotGameId,
              duration,
              key: null,
              amount_spent: 0,
              game_name: robotSnapshot.game?.name || item.productName || "",
              robot_balance: robotSnapshot.balance,
              is_free: true,
              download_url: freeDownloadUrl,
              file_name: freeFileName,
              loader_only: true,
            },
          })
          .select("id")
          .single();

        if (ticket) {
          let deliveryMsg =
            `✅ Produto gratuito liberado!\n\n📥 Baixe o loader no link abaixo, crie sua conta no programa e faça login — **não há chave**; a API Robot não emite keys para jogos gratuitos.\n\n📥 **Download:** ${freeDownloadUrl}`;
          if (freeFileName) deliveryMsg += `\n📄 Arquivo: ${freeFileName}`;
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: payment.user_id,
            sender_role: "staff",
            message: deliveryMsg,
          });
        }
        console.log(`Robot fulfillment success (free, skip-buy): gameId=${robotGameId}`);
        return;
      }

      const reason =
        "Jogo gratuito sem URL de download: configure o link do loader na API Robot (GET /games) ou em Tutorial → arquivo do produto.";
      log("ERROR", "fulfillRobot", "Free game: no loader URL (skip /buy per Robot API)", { robotGameId, duration });

      const { data: ticket } = await supabaseAdmin
        .from("order_tickets")
        .insert({
          user_id: payment.user_id,
          product_id: item.productId,
          product_plan_id: item.planId,
          stock_item_id: null,
          status: "open",
          status_label: "Entrega Manual",
          metadata: {
            type: "robot-project",
            robot_game_id: robotGameId,
            duration,
            is_free: true,
            loader_only: true,
            error: reason,
          },
        })
        .select("id")
        .single();

      if (ticket) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message:
            `✅ Pagamento confirmado!\n\n⚠️ Este jogo é **gratuito** na Robot: a API não envia mais chave — só o download do loader. Não encontramos o link automático.\n\nNossa equipe vai enviar o link do loader ou orientação em breve. Enquanto isso, verifique a documentação da API Robot ou o tutorial cadastrado no produto.`,
        });
      }

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
                title: "⚠️ Jogo Robot gratuito sem URL de loader",
                description: "A API não retorna chave para free; configure download em GET /games ou tutorial do produto.",
                color: 0xFF8800,
                fields: [
                  { name: "Produto", value: item.productName || "?", inline: true },
                  { name: "game_id", value: String(robotGameId), inline: true },
                  { name: "Ticket", value: ticket?.id?.substring(0, 8).toUpperCase() || "—", inline: true },
                ],
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        }
      } catch (_) { /* ignore */ }

      return;
    }

    const buyRes = await fetch(`https://api.robotproject.com.br/buy/${encodeURIComponent(robotGameId)}`, {
      method: "POST",
      headers: {
        Authorization: robotAuthHeader(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duration: Number(duration) }),
    });

    // Safely parse JSON — Robot API may return HTML on errors/maintenance
    let buyData: Record<string, unknown> = {};
    const robotCt = buyRes.headers.get("content-type") || "";
    if (robotCt.includes("application/json") || robotCt.includes("text/json")) {
      try { buyData = await buyRes.json(); } catch { buyData = { error: "Invalid JSON response from Robot API" }; }
    } else {
      const bodyPreview = await buyRes.text().then(t => t.substring(0, 200));
      buyData = { error: `Non-JSON response: ${bodyPreview}` };
    }
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

    // Success! Paid: deliver key. Free (fallback): never expose key — só loader / conta no programa.
    const rawKey = String(buyData.data?.key || "");
    const formattedKey = rawKey.length >= 8 && !rawKey.includes("-")
      ? rawKey.match(/.{1,4}/g)?.join("-") || rawKey
      : rawKey;
    const gameName = buyData.data?.gameName || item.productName || "";
    const amountSpent = buyData.data?.amountSpent || 0;
    const robotBalance = buyData.data?.balance ?? null;
    const buyGame = buyData.data?.game as Record<string, unknown> | undefined;
    const isFreeGame =
      snapshotGameFree ||
      buyGame?.free === true ||
      robotGameIsFreeFlag(buyGame) ||
      buyData.data?.finalAmount === 0;
    const buyDl = robotGameDownloadFields(buyGame);
    const downloadUrl = buyDl.downloadUrl || snapDl.downloadUrl || null;
    const fileName = buyDl.fileName || snapDl.fileName || null;
    const key = isFreeGame ? "" : formattedKey;
    const hasKey = key.length > 0;

    // Store stock item only if there's an actual key
    let stockItem: { id: string } | null = null;
    if (hasKey) {
      const { data } = await supabaseAdmin
        .from("stock_items")
        .insert({
          product_plan_id: item.planId,
          content: `Key: ${key}`,
          used: true,
          used_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      stockItem = data;
    }

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
          key: hasKey ? key : null,
          amount_spent: amountSpent,
          game_name: gameName,
          robot_balance: robotBalance,
          is_free: isFreeGame,
          download_url: downloadUrl,
          file_name: fileName,
          loader_only: isFreeGame && !hasKey,
        },
      })
      .select("id")
      .single();

    if (ticket) {
      // Build delivery message
      let deliveryMsg: string;
      if (isFreeGame) {
        deliveryMsg =
          `✅ Produto gratuito liberado!\n\n📥 Baixe o loader e crie sua conta no programa — **não é necessário chave** neste modo.`;
      } else if (hasKey) {
        deliveryMsg = `✅ Seu produto foi entregue automaticamente!\n\n🔑 **Key:** \`${key}\`\n⏱️ Duração: ${duration} dias`;
      } else {
        deliveryMsg = `✅ Seu produto foi entregue automaticamente!`;
      }
      if (downloadUrl) {
        deliveryMsg += `\n\n📥 **Download:** ${downloadUrl}`;
        if (fileName) {
          deliveryMsg += `\n📄 Arquivo: ${fileName}`;
        }
      }
      if (hasKey && !isFreeGame) {
        deliveryMsg += `\n\nVeja a chave acima para ativar.`;
      }

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

  } catch (err: unknown) {
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
        metadata: { type: "robot-project", robot_game_id: robotGameId, duration, error: errorMessage(err) },
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
  supabaseAdmin: SupabaseAdminClient,
  cartSnapshot: CartSnapshotItem[],
  userId: string,
  couponId: string | null
): Promise<{ validatedAmount: number; validatedDiscount: number; validatedCart: CartSnapshotItem[]; error?: string }> {
  if (!Array.isArray(cartSnapshot) || cartSnapshot.length === 0) {
    return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Carrinho vazio" };
  }

  let totalAmount = 0;
  const validatedCart: CartSnapshotItem[] = [];
  /** Lazy FX for LZT cost — matches getLiveRates() (USD+RUB) instead of hardcoded RUB. */
  let lztFxCache: { rub: number; usd: number } | null = null;
  const getLztFxRates = async () => {
    if (!lztFxCache) lztFxCache = await getLiveRates();
    return lztFxCache;
  };

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

      const lztQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (lztQty !== 1) {
        return {
          validatedAmount: 0,
          validatedDiscount: 0,
          validatedCart: [],
          error: "Cada conta do mercado deve ser comprada com quantidade 1.",
        };
      }

      const lztToken = await getLztMarketToken(supabaseAdmin);
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
      // Safely parse JSON — LZT API may return HTML (Cloudflare)
      const lztValidateCt = lztRes.headers.get("content-type") || "";
      if (!lztValidateCt.includes("application/json")) {
        console.warn(`LZT validation response non-JSON (${lztRes.status}): ${lztValidateCt}`);
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Erro ao verificar conta. Tente novamente em alguns segundos." };
      }
      let lztData: Record<string, unknown> | null = null;
      try { lztData = await lztRes.json(); } catch {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Resposta inválida do servidor de contas." };
      }
      const lztItem = lztData?.item as Record<string, unknown> | undefined;
      const realLztPrice = Number(lztItem?.price) || 0;
      const realLztCurrency = (lztItem?.price_currency as string) || "rub";

      // Check if item is still available for purchase
      // canBuyItem === false, buyer !== null, or item_state !== "active" means unavailable
      const itemState = lztItem?.item_state;
      const isSold = lztItem?.buyer != null || lztItem?.canBuyItem === false || (itemState && itemState !== "active");
      if (realLztPrice <= 0 || isSold) {
        console.warn(`LZT item ${lztItemId} unavailable: price=${realLztPrice}, buyer=${lztItem?.buyer}, canBuyItem=${lztItem?.canBuyItem}, item_state=${itemState}`);
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Esta conta já foi vendida ou não está mais disponível. Por favor, escolha outra conta.` };
      }

      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .maybeSingle();
      
      // Check for admin price override
      const { data: priceOverride } = await supabaseAdmin
        .from("lzt_price_overrides")
        .select("custom_price_brl")
        .eq("lzt_item_id", String(lztItemId))
        .maybeSingle();
      
      const hasOverride = priceOverride && Number(priceOverride.custom_price_brl) > 0;
      const overridePrice = hasOverride ? Number(priceOverride.custom_price_brl) : null;

      const gameCategory = item.lztGame || item.gameCategory || "";
      const toMarkup = (v: unknown, fallback: number): number => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 ? n : fallback;
      };
      let markup = toMarkup(lztConfig?.markup_multiplier, 3.0);
      if (gameCategory === "valorant" && lztConfig?.markup_valorant != null) {
        markup = toMarkup(lztConfig.markup_valorant, markup);
      } else if (gameCategory === "lol" && lztConfig?.markup_lol != null) {
        markup = toMarkup(lztConfig.markup_lol, markup);
      } else if (gameCategory === "fortnite" && lztConfig?.markup_fortnite != null) {
        markup = toMarkup(lztConfig.markup_fortnite, markup);
      } else if (gameCategory === "minecraft" && lztConfig?.markup_minecraft != null) {
        markup = toMarkup(lztConfig.markup_minecraft, markup);
      }

      const { rub: RUB_TO_BRL, usd: USD_TO_BRL } = await getLztFxRates();
      const costBrl = realLztCurrency === "rub"
        ? realLztPrice * RUB_TO_BRL
        : realLztCurrency === "usd"
        ? realLztPrice * USD_TO_BRL
        : realLztPrice;
      
      // The price the customer saw (sent from frontend)
      const clientDisplayPrice = Number(item.price) || 0;
      
      // Recalculate what the price SHOULD be now (for reference)
      const currentCalcPrice = Math.round(costBrl * markup * 100) / 100;
      const MIN_PRICE = 20;
      const currentFairPrice = overridePrice || (currentCalcPrice < MIN_PRICE ? MIN_PRICE : currentCalcPrice);
      
      // PRICE LOCK STRATEGY:
      // - Use the price the customer saw (clientDisplayPrice) if it covers our cost
      // - If admin set an override, allow it even if below cost (intentional discount)
      // - If cost went up so much we'd lose money (and no override), reject the purchase
      // - If client didn't send a price, use current calculated price
      let finalPrice: number;
      
      if (clientDisplayPrice > 0) {
        // If admin set an override, trust it — don't reject intentional discounts
        if (hasOverride) {
          finalPrice = clientDisplayPrice;
          console.log(`LZT PRICE LOCKED (override active): itemId=${lztItemId}, lockedPrice=${finalPrice}, overridePrice=${overridePrice}, cost=${costBrl.toFixed(2)}`);
        } else {
          // ⚠️ ENFORCE MINIMUM 50% MARGIN:
          // If the client price (locked at checkout) is below 2.0x our cost, we reject it.
          // This ensures the 50% minimum margin is respected even if prices fluctuate slightly on LZT.
          if (clientDisplayPrice < costBrl * 2.00) {
            console.error(`LZT PRICE LOCK REJECTED: itemId=${lztItemId}, clientPrice=${clientDisplayPrice}, cost=${costBrl.toFixed(2)}, threshold=${(costBrl * 2.00).toFixed(2)} (Min 50% Margin required)`);
            return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "O preço desta conta foi atualizado. Por favor, remova do carrinho e adicione novamente." };
          }
          // Lock to the price the customer saw
          finalPrice = clientDisplayPrice;
          console.log(`LZT PRICE LOCKED: itemId=${lztItemId}, lockedPrice=${finalPrice}, cost=${costBrl.toFixed(2)}, currentFair=${currentFairPrice}, margin=${((finalPrice - costBrl) / finalPrice * 100).toFixed(1)}%`);
        }

      } else {
        // No client price sent — use current calculated price (backwards compat)
        finalPrice = currentFairPrice;
        console.log(`LZT PRICE CALCULATED (no lock): itemId=${lztItemId}, price=${finalPrice}, cost=${costBrl.toFixed(2)}`);
      }
      
      totalAmount += Math.round(finalPrice * 100);
      validatedCart.push({
        ...item,
        price: finalPrice,
        lztPrice: realLztPrice,
        lztCurrency: realLztCurrency,
        quantity: 1,
      });
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

    const { data: productData } = await supabaseAdmin
      .from("products")
      .select("robot_game_id, robot_markup_percent")
      .eq("id", plan.product_id)
      .maybeSingle();

    const isRobotProduct = !!(productData?.robot_game_id && productData.robot_game_id > 0);

    let robotSnapshotForPlan: Awaited<ReturnType<typeof fetchRobotGameSnapshot>> | null = null;

    if (isRobotProduct) {
      const creds = await getRobotCredentials(supabaseAdmin);
      if (!creds) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Credenciais da Robot Project não configuradas" };
      }

      robotSnapshotForPlan = await fetchRobotGameSnapshot(creds, productData.robot_game_id, plan.robot_duration_days || 30);
      log("INFO", "validatePrice", "Robot product pre-check", {
        productId: plan.product_id,
        robotGameId: productData.robot_game_id,
        duration: plan.robot_duration_days || 30,
        expectedPrice: robotSnapshotForPlan.expectedPrice,
        balance: robotSnapshotForPlan.balance,
        availableSlots: robotSnapshotForPlan.availableSlots,
        reason: robotSnapshotForPlan.reason || null,
      });

      if (robotSnapshotForPlan.reason) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: robotSnapshotForPlan.reason };
      }
    }

    // R$ 0: produto normal gratuito (stock/tutorial) OU jogo Robot marcado como is_free na API
    if (realPrice <= 0) {
      const robotGameIsFree = !!(isRobotProduct && robotGameIsFreeFlag(robotSnapshotForPlan?.game));
      const nonRobotFreeProduct = !isRobotProduct;

      if (robotGameIsFree || nonRobotFreeProduct) {
        realPrice = 0;
      } else if (productData?.robot_game_id && productData.robot_markup_percent && plan.robot_duration_days) {
        const creds = await getRobotCredentials(supabaseAdmin);
        if (creds) {
          try {
            const robotSnapshot = robotSnapshotForPlan ||
              await fetchRobotGameSnapshot(creds, productData.robot_game_id, plan.robot_duration_days);
            const basePriceUsd = robotSnapshot.expectedPrice;
            if (basePriceUsd !== null && basePriceUsd > 0) {
              const costPriceUsd = basePriceUsd * 0.6;
              let usdToBrl = 6.10;
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
          } catch (err) {
            console.error("Failed to fetch robot prices for validation:", err);
          }
        }
      }

      if (realPrice <= 0 && !robotGameIsFree && !nonRobotFreeProduct) {
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

  // Carrinho 100% gratuito (só planos R$ 0) → centavos 0. Pagos continuam com mínimo R$ 1,00.
  const rawCents = totalAmount - validatedDiscount;
  const finalAmount = totalAmount === 0 ? 0 : Math.max(100, rawCents);

  return {
    validatedAmount: finalAmount,
    validatedDiscount: validatedDiscount / 100,
    validatedCart,
  };
}

// ========== MISTICPAY HELPERS ==========
async function getMisticPayCredentials(supabaseAdmin: SupabaseAdminClient): Promise<{ clientId: string; clientSecret: string } | null> {
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
  if (!state) return "ACTIVE";
  const s = state.toUpperCase();
  if (["COMPLETO", "CONCLUIDO", "PAID", "SUCCESS", "COMPLETED"].includes(s)) return "COMPLETED";
  if (["FALHA", "RECUSADO", "FAILED", "REJECTED"].includes(s)) return "FAILED";
  if (["PENDENTE", "WAITING", "ACTIVE"].includes(s)) return "ACTIVE";
  return "ACTIVE";
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
type CleanupMapValue = number | { windowStart?: number };

function cleanupMap(map: Map<string, CleanupMapValue>, maxSize: number) {
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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("pix-payment: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

      // Replay prevention: reject webhooks with timestamps older than 24 hours
      const webhookTimestamp = body.timestamp || body.createdAt || body.updatedAt;
      if (webhookTimestamp) {
        const webhookTime = new Date(webhookTimestamp).getTime();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (!isNaN(webhookTime) && (now - webhookTime) > maxAge) {
          console.error("Webhook rejected: timestamp too old", webhookTimestamp);
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
          await sendServerPurchaseEvent(supabaseAdmin, payment, req);
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

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
  if (!anonKey) {
    console.error("pix-payment: missing SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    if (claimsError?.message) console.warn("pix-payment auth:", claimsError.message);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  if (typeof userId !== "string" || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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
      const { cart_snapshot, coupon_id, meta_user_data, customer_data } = body;

      const [validationResult, profileResult] = await Promise.all([
        validateAndCalculatePrice(supabaseAdmin, cart_snapshot as CartSnapshotItem[], userId, coupon_id),
        supabaseAdmin.from("profiles").select("username").eq("user_id", userId).maybeSingle(),
      ]);

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

      if (amountCents === 0) {
        const { data: payment, error: insertError } = await supabaseAdmin
          .from("payments")
          .insert({
            user_id: userId,
            charge_id: null,
            external_id: `free-${internalTxId}`,
            amount: 0,
            status: "COMPLETED",
            paid_at: new Date().toISOString(),
            cart_snapshot: validatedCart,
            coupon_id: coupon_id || null,
            discount_amount: validatedDiscount,
            payment_method: "free",
            meta_tracking: meta_user_data || null,
            customer_data: customer_data || null,
          })
          .select("*")
          .single();

        if (insertError) {
          console.error("Free claim insert error:", insertError);
          return new Response(JSON.stringify({ error: "Erro ao registrar produto gratuito" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await fulfillOrder(supabaseAdmin, payment);
        await sendDiscordSaleNotification(supabaseAdmin, payment);
        await sendServerPurchaseEvent(supabaseAdmin, payment, req);
        await assignDiscordClientRole(supabaseAdmin, payment.user_id);

        lastPaymentCreateMap.set(userId, Date.now());
        cleanupMap(lastPaymentCreateMap, 2000);

        const first = validatedCart[0] as { productId?: string; planId?: string } | undefined;
        let ticketId: string | null = null;
        if (first?.productId && first?.planId) {
          const { data: trow } = await supabaseAdmin
            .from("order_tickets")
            .select("id")
            .eq("user_id", userId)
            .eq("product_id", first.productId)
            .eq("product_plan_id", first.planId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          ticketId = (trow as { id?: string } | null)?.id ?? null;
        }

        return new Response(
          JSON.stringify({
            success: true,
            payment_id: payment.id,
            validated_amount: 0,
            validated_discount: validatedDiscount,
            claimed_free: true,
            ticket_id: ticketId,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const misticCreds = await getMisticPayCredentials(supabaseAdmin);
      if (!misticCreds) {
        return new Response(JSON.stringify({ error: "MisticPay credentials not configured (MISTICPAY_CLIENT_ID / MISTICPAY_CLIENT_SECRET)" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          meta_tracking: meta_user_data || null,
          customer_data: customer_data || null,
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
              await sendServerPurchaseEvent(supabaseAdmin, payment, req);
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
        await sendServerPurchaseEvent(supabaseAdmin, payment, req);
        await assignDiscordClientRole(supabaseAdmin, payment.user_id);
      }

      return new Response(
        JSON.stringify({ success: true, status: "COMPLETED", message: "Pagamento validado e produtos entregues" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== RETRY ROBOT FULFILLMENT (admin-only) ====================
    if (action === "retry-robot" && req.method === "POST") {
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
      const { ticket_id } = body;

      if (!ticket_id) {
        return new Response(JSON.stringify({ error: "ticket_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ticket } = await supabaseAdmin
        .from("order_tickets")
        .select("id, user_id, product_id, product_plan_id, status, metadata")
        .eq("id", ticket_id)
        .single();

      if (!ticket) {
        return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const meta = (ticket.metadata || {}) as Record<string, unknown>;
      if (meta.type !== "robot-project") {
        return new Response(JSON.stringify({ error: "Este ticket não é do Robot Project" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ticket.status === "delivered") {
        return new Response(JSON.stringify({ success: true, message: "Este ticket já foi entregue" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("user_id", ticket.user_id)
        .eq("status", "COMPLETED")
        .contains("cart_snapshot", [{ productId: ticket.product_id, planId: ticket.product_plan_id }])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!payment) {
        return new Response(JSON.stringify({ error: "Pagamento concluído não encontrado para este ticket" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [productDataRes, planDataRes] = await Promise.all([
        supabaseAdmin.from("products").select("name, robot_game_id, robot_markup_percent").eq("id", ticket.product_id).single(),
        supabaseAdmin.from("product_plans").select("name, price, robot_duration_days").eq("id", ticket.product_plan_id).single(),
      ]);

      const productData = productDataRes.data;
      const planData = planDataRes.data;

      if (!productData?.robot_game_id || !planData) {
        return new Response(JSON.stringify({ error: "Configuração Robot inválida para este ticket" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: userId,
          sender_role: "staff",
          message: "🔄 Reprocessando entrega automática. Aguarde alguns instantes...",
        });

      const item = {
        productId: ticket.product_id,
        planId: ticket.product_plan_id,
        productName: productData.name,
        planName: planData.name,
        price: Number(planData.price || 0),
        quantity: 1,
      };

      await fulfillRobotProduct(
        supabaseAdmin,
        payment as PaymentRow,
        item,
        productData as RobotProductRow,
        planData as RobotPlanRow,
      );

      return new Response(JSON.stringify({ success: true, message: "Reprocessamento da entrega Robot executado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
