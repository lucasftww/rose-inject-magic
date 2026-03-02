import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FLOWPAY_URL = "https://flowpayments.net/api/pix";
const FLOWPAY_CARD_URL = "https://flowpayments.net/api/card";
const FLOWPAY_CRYPTO_URL = "https://flowpayments.net/api/crypto";

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
    const discount = payment.discount_amount ? (payment.discount_amount / 100).toFixed(2) : null;

    const itemsList = cartItems.map((item) =>
      `> 🎮 **${item.productName}** — ${item.planName}\n> 💵 R$ ${Number(item.price).toFixed(2)} × ${item.quantity || 1}`
    ).join("\n\n");

    const now = new Date();
    const timestamp = now.toISOString();

    const embed = {
      title: "💰 Nova Venda Realizada!",
      description: `@everyone\n\n${itemsList}`,
      color: 0x00FF6A, // green accent
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
        text: "Inject Store • Sistema de Vendas",
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

// Helper: fulfill order (deliver stock, create tickets, record coupon)
async function fulfillOrder(supabaseAdmin: any, payment: any) {
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
    .select("id, discount_percent")
    .eq("user_id", payment.user_id)
    .eq("active", true)
    .maybeSingle();

  for (const item of cartItems) {
    // Skip raspadinha items - fulfillment handled client-side
    if (item.type === "raspadinha" || item.planId === "raspadinha") {
      console.log("Skipping raspadinha fulfillment (handled client-side)");
      continue;
    }

    // Handle LZT Market accounts (check type or planId fallback)
    const isLztAccount = item.type === "lzt-account" || item.planId === "lzt-account";
    if (isLztAccount) {
      // Extract lztItemId from productId if not in the snapshot (e.g. "lzt-216971233" -> "216971233")
      const lztItemId = item.lztItemId || item.productId?.replace("lzt-", "") || "";
      if (lztItemId) {
        await fulfillLztAccount(supabaseAdmin, payment, { ...item, lztItemId });
      } else {
        console.error("LZT account item missing lztItemId:", item);
      }
      continue;
    }

    // Regular product fulfillment
    let originalPrice = item.price || 0;
    if (resellerData) {
      const { data: planData } = await supabaseAdmin
        .from("product_plans")
        .select("price")
        .eq("id", item.planId)
        .single();
      if (planData) originalPrice = Number(planData.price);
    }

    for (let i = 0; i < (item.quantity || 1); i++) {
      const { data: stockItem } = await supabaseAdmin
        .from("stock_items")
        .select("id")
        .eq("product_plan_id", item.planId)
        .eq("used", false)
        .limit(1)
        .single();

      const stockId = stockItem?.id || null;

      if (stockId) {
        await supabaseAdmin
          .from("stock_items")
          .update({ used: true, used_at: new Date().toISOString() })
          .eq("id", stockId);
      }

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
        // No stock available — notify client and flag for manual delivery
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

        const { data: productData } = await supabaseAdmin
          .from("products")
          .select("tutorial_text, tutorial_file_url")
          .eq("id", item.productId)
          .single();

        if (productData?.tutorial_text) {
          const txtContent = productData.tutorial_text;
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

        if (productData?.tutorial_file_url) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: payment.user_id,
            sender_role: "staff",
            message: `📎 **Arquivo:** ${productData.tutorial_file_url}`,
          });
        }
      }

      if (resellerData && stockId) {
        await supabaseAdmin.from("reseller_purchases").insert({
          reseller_id: resellerData.id,
          product_plan_id: item.planId,
          stock_item_id: stockId,
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

  // Record coupon usage
  if (payment.coupon_id) {
    await supabaseAdmin
      .from("coupon_usage")
      .insert({ coupon_id: payment.coupon_id, user_id: payment.user_id });
  }
}

// LZT Market account purchase and delivery
async function fulfillLztAccount(supabaseAdmin: any, payment: any, item: any) {
  // Read LZT token from system_credentials
  const { data: lztCred } = await supabaseAdmin
    .from("system_credentials")
    .select("value")
    .eq("env_key", "LZT_API_TOKEN")
    .maybeSingle();
  const LZT_TOKEN = lztCred?.value || Deno.env.get("LZT_MARKET_TOKEN");

  const itemId = item.lztItemId;
  let price = item.lztPrice;
  let currency = item.lztCurrency || "rub";

  // Helper to find product/plan for the ticket system
  const findProductAndPlan = async () => {
    let productId: string | null = null;
    let planId: string | null = null;

    const { data: lztProduct } = await supabaseAdmin
      .from("products")
      .select("id")
      .ilike("name", "%valorant%conta%")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (lztProduct) {
      productId = lztProduct.id;
      const { data: plan } = await supabaseAdmin
        .from("product_plans")
        .select("id")
        .eq("product_id", productId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      planId = plan?.id || null;
    }

    if (!productId) {
      const { data: fallback } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("active", true)
        .limit(1)
        .single();
      productId = fallback?.id;
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
    }

    return { productId, planId };
  };

  // Helper to create a manual delivery ticket (fallback when LZT purchase fails)
  const createManualDeliveryTicket = async (reason: string) => {
    console.log(`Creating manual delivery ticket for LZT item ${itemId}. Reason: ${reason}`);

    const { productId, planId } = await findProductAndPlan();
    if (!productId || !planId) {
      console.error("No product/plan found for LZT manual delivery ticket");
      return;
    }

    const lztMetadata = {
      type: "lzt-account",
      lzt_item_id: itemId,
      account_name: item.productName || `Conta Valorant #${itemId}`,
      account_image: item.productImage || null,
      price_paid: item.price || price,
      currency: currency,
      skins_count: item.skinsCount || null,
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
      // Message for the client
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ Seu pagamento foi confirmado!\n\n⚠️ Houve um problema ao processar a entrega automática da conta. Nossa equipe irá entregar manualmente em breve.\n\nSe tiver dúvidas, envie uma mensagem aqui neste chat.`,
      });
    }

    return ticket;
  };

  // If no LZT token configured — create manual ticket immediately
  if (!LZT_TOKEN) {
    console.error("LZT_MARKET_TOKEN not configured — falling back to manual delivery");
    await createManualDeliveryTicket("LZT token not configured");
    return;
  }

  // If price is missing, fetch current price from LZT API
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

  console.log(`Purchasing LZT account ${itemId} at price ${price} ${currency}`);

  try {
    // Fast-buy the account on LZT Market
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

    // --- PURCHASE FAILED: fallback to manual delivery ---
    if (!buyRes.ok) {
      const reason = `HTTP ${buyRes.status}: ${JSON.stringify(buyData).substring(0, 300)}`;
      console.error("LZT fast-buy failed:", reason);
      await createManualDeliveryTicket(reason);
      return;
    }

    // --- PURCHASE SUCCEEDED ---
    const boughtItem = buyData.item;
    const loginData = boughtItem?.loginData;

    let email = loginData?.login || loginData?.email || boughtItem?.email || "";
    let password = loginData?.password || boughtItem?.password || "";
    let rawCredentials = loginData?.raw || "";
    let accountEmail = loginData?.email || boughtItem?.email || boughtItem?.emailLoginData || "";

    // If no separate fields, try to parse raw (format: login:password)
    if (!email && rawCredentials) {
      const parts = rawCredentials.split(":");
      if (parts.length >= 2) {
        email = parts[0];
        password = parts.slice(1).join(":");
      }
    }

    if (accountEmail === email && boughtItem?.item_origin === "autoreg") {
      accountEmail = boughtItem?.email || loginData?.email || "";
    }

    // Build stock content
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

    // Create stock item
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

    // Create order ticket with LZT metadata
    const lztMetadata = {
      type: "lzt-account",
      lzt_item_id: itemId,
      account_name: item.productName || `Conta Valorant #${itemId}`,
      account_image: item.productImage || null,
      price_paid: item.price || price,
      currency: currency,
      skins_count: item.skinsCount || null,
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
      const credentialData = JSON.stringify({ login: email, password: password, email: accountEmail });
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

    // Record sale in lzt_sales for admin dashboard
    const RUB_TO_BRL = 0.055;
    const buyPriceBrl = currency === "rub" ? Number(price) * RUB_TO_BRL : Number(price);
    const sellPriceBrl = Number(item.price) || 0;
    const { error: saleErr } = await supabaseAdmin.from("lzt_sales").insert({
      lzt_item_id: String(itemId),
      buy_price: buyPriceBrl,
      sell_price: sellPriceBrl,
      profit: sellPriceBrl - buyPriceBrl,
      account_title: item.productName || `Conta #${itemId}`,
      buyer_user_id: payment.user_id,
    });
    if (saleErr) console.error("Failed to record lzt_sale:", saleErr);
    else console.log("LZT sale recorded:", itemId);

  } catch (err: any) {
    console.error("LZT account purchase error:", err);
    // Network/timeout error — fallback to manual delivery
    await createManualDeliveryTicket(`Exception: ${err?.message || String(err)}`);
  }
}

// ========== SERVER-SIDE PRICE VALIDATION ==========
// Prevents price manipulation via Burp Suite, API requests, or frontend tampering
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
    // Handle raspadinha items
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
      totalAmount += realPrice * qty * 100; // convert to cents
      validatedCart.push({ ...item, price: realPrice, quantity: qty });
      continue;
    }

    // Handle LZT accounts — price comes from LZT API via lzt_config markup
    if (item.type === "lzt-account") {
      // For LZT accounts, we need the lzt_config per-game markup to validate
      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .single();
      
      // Determine which markup to use based on game category
      const gameCategory = item.lztGame || item.gameCategory || "";
      let markup = lztConfig?.markup_multiplier || 1.5;
      if (gameCategory === "valorant" && lztConfig?.markup_valorant) markup = lztConfig.markup_valorant;
      else if (gameCategory === "lol" && lztConfig?.markup_lol) markup = lztConfig.markup_lol;
      else if (gameCategory === "fortnite" && lztConfig?.markup_fortnite) markup = lztConfig.markup_fortnite;
      else if (gameCategory === "minecraft" && lztConfig?.markup_minecraft) markup = lztConfig.markup_minecraft;
      
      // The lztPrice is the original price in RUB, we apply our markup
      const lztPrice = Number(item.lztPrice) || 0;
      if (lztPrice <= 0) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Preço inválido para conta LZT ${item.lztItemId}` };
      }
      // Use Math.round instead of Math.ceil to match frontend pricing exactly
      const RUB_TO_BRL = 0.055;
      let brlPrice = lztPrice * RUB_TO_BRL;
      const expectedPrice = Math.round(brlPrice * markup * 100) / 100;
      const MIN_PRICE = 20;
      const finalPrice = expectedPrice < MIN_PRICE ? MIN_PRICE : expectedPrice;
      console.log(`LZT price: lztPrice=${lztPrice}, brl=${brlPrice.toFixed(2)}, markup=${markup}, serverPrice=${finalPrice}, clientPrice=${Math.round(Number(item.price) * 100) / 100}, game=${gameCategory}`);
      totalAmount += Math.round(finalPrice * 100);
      validatedCart.push({ ...item, price: finalPrice });
      continue;
    }

    // Regular products — fetch real price from database
    const planId = item.planId;
    if (!planId) {
      return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: "Plano não especificado" };
    }

    const { data: plan } = await supabaseAdmin
      .from("product_plans")
      .select("id, price, active, product_id")
      .eq("id", planId)
      .single();

    if (!plan || !plan.active) {
      return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Plano ${planId} não encontrado ou inativo` };
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    let realPrice = Number(plan.price);

    // Check if user is a reseller and apply discount
    const { data: resellerData } = await supabaseAdmin
      .from("resellers")
      .select("discount_percent, active")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    if (resellerData) {
      realPrice = realPrice * (1 - resellerData.discount_percent / 100);
    }

    totalAmount += Math.round(realPrice * 100) * qty;
    validatedCart.push({ ...item, price: realPrice, quantity: qty });
  }

  // Validate coupon server-side
  let validatedDiscount = 0;
  if (couponId) {
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("id", couponId)
      .eq("active", true)
      .single();

    if (coupon) {
      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        console.log("Coupon expired, ignoring");
      }
      // Check max uses
      else if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        console.log("Coupon max uses reached, ignoring");
      }
      // Check if user already used this coupon
      else {
        const { data: usage } = await supabaseAdmin
          .from("coupon_usage")
          .select("id")
          .eq("coupon_id", couponId)
          .eq("user_id", userId)
          .maybeSingle();

        if (usage) {
          console.log("User already used this coupon, ignoring");
        } else {
          // Check min order value
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

  const finalAmount = Math.max(100, totalAmount - validatedDiscount); // minimum R$1.00

  return {
    validatedAmount: finalAmount,
    validatedDiscount: validatedDiscount / 100,
    validatedCart,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth check
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

  // Read FLOWPAY_API_KEY from system_credentials
  const { data: flowpayCred } = await supabaseAdmin
    .from("system_credentials")
    .select("value")
    .eq("env_key", "FLOWPAY_API_KEY")
    .maybeSingle();
  const FLOWPAY_API_KEY = flowpayCred?.value || Deno.env.get("FLOWPAY_API_KEY");

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // CREATE PIX CHARGE
    if (action === "create" && req.method === "POST") {
      if (!FLOWPAY_API_KEY) {
        return new Response(JSON.stringify({ error: "FLOWPAY_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { cart_snapshot, coupon_id } = body;

      // SERVER-SIDE PRICE VALIDATION — ignore client amount/discount
      const { validatedAmount, validatedDiscount, validatedCart, error: validationError } =
        await validateAndCalculatePrice(supabaseAdmin, cart_snapshot, userId, coupon_id);

      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amount = validatedAmount;

      const fpRes = await fetch(`${FLOWPAY_URL}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": FLOWPAY_API_KEY,
        },
        body: JSON.stringify({
          value: amount,
          description: `Compra Inject Project - ${validatedCart.length} item(s)`,
          expiresIn: 1800,
        }),
      });

      const fpData = await fpRes.json();
      if (!fpRes.ok || !fpData.success) {
        console.error("FlowPay error:", fpData);
        return new Response(JSON.stringify({ error: "Erro ao criar cobrança PIX" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment, error: insertError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          charge_id: fpData.charge.id,
          amount,
          status: "ACTIVE",
          cart_snapshot: validatedCart,
          coupon_id: coupon_id || null,
          discount_amount: validatedDiscount,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          charge: {
            id: fpData.charge.id,
            brCode: fpData.charge.brCode,
            qrCodeImage: fpData.charge.qrCodeImage,
            expiresAt: fpData.charge.expiresAt,
          },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK STATUS
    if (action === "status" && req.method === "GET") {
      const paymentId = url.searchParams.get("payment_id");
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow users to check their own payments
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

      // Check on FlowPay
      if (FLOWPAY_API_KEY) {
        const fpRes = await fetch(`${FLOWPAY_URL}/status?id=${payment.charge_id}`, {
          headers: { "x-api-key": FLOWPAY_API_KEY },
        });

        const fpData = await fpRes.json();
        if (fpRes.ok) {
          const newStatus = fpData.charge?.status || "ACTIVE";

          if (newStatus !== payment.status) {
            const updates: Record<string, unknown> = { status: newStatus };
            if (newStatus === "COMPLETED") {
              updates.paid_at = fpData.charge?.paidAt || new Date().toISOString();
            }
            // Atomic update: only update if status hasn't changed (prevents race condition / duplicate fulfillment)
            const { data: updatedPayment } = await supabaseAdmin
              .from("payments")
              .update(updates)
              .eq("id", paymentId)
              .eq("status", payment.status)
              .select("id")
              .maybeSingle();

            // Only fulfill if WE were the one to transition the status
            if (newStatus === "COMPLETED" && updatedPayment) {
              await fulfillOrder(supabaseAdmin, payment);
              await sendDiscordSaleNotification(supabaseAdmin, payment);
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

    // FORCE COMPLETE (admin-only manual validation)
    if (action === "force-complete" && req.method === "POST") {
      // SECURITY: Only admins can force-complete payments
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

      // Mark as completed atomically
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

      // Only fulfill if we actually transitioned the status
      if (updatedPayment) {
        await fulfillOrder(supabaseAdmin, payment);
        await sendDiscordSaleNotification(supabaseAdmin, payment);
      }

      return new Response(
        JSON.stringify({ success: true, status: "COMPLETED", message: "Pagamento validado e produtos entregues" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE CARD CHARGE
    if (action === "create-card" && req.method === "POST") {
      if (!FLOWPAY_API_KEY) {
        return new Response(JSON.stringify({ error: "FLOWPAY_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { cart_snapshot, coupon_id } = body;

      // SERVER-SIDE PRICE VALIDATION
      const { validatedAmount, validatedDiscount, validatedCart, error: validationError } =
        await validateAndCalculatePrice(supabaseAdmin, cart_snapshot, userId, coupon_id);

      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amount = validatedAmount;

      const fpRes = await fetch(`${FLOWPAY_CARD_URL}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": FLOWPAY_API_KEY,
        },
        body: JSON.stringify({
          value: amount,
          description: `Compra Inject Project - ${validatedCart.length} item(s)`,
        }),
      });

      const fpData = await fpRes.json();
      if (!fpRes.ok || !fpData.success) {
        console.error("FlowPay card error:", fpData);
        return new Response(JSON.stringify({ error: "Erro ao criar cobrança de cartão" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment, error: insertError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          charge_id: fpData.payment.id,
          amount,
          status: "ACTIVE",
          cart_snapshot: validatedCart,
          coupon_id: coupon_id || null,
          discount_amount: validatedDiscount,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          paymentUrl: fpData.payment.paymentUrl,
          charge_id: fpData.payment.id,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK CARD STATUS
    if (action === "card-status" && req.method === "GET") {
      const paymentId = url.searchParams.get("payment_id");
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow users to check their own payments
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

      // Check on FlowPay Card API
      if (FLOWPAY_API_KEY) {
        const fpRes = await fetch(`${FLOWPAY_CARD_URL}/status?id=${payment.charge_id}`, {
          headers: { "x-api-key": FLOWPAY_API_KEY },
        });

        const fpData = await fpRes.json();
        if (fpRes.ok && fpData.payment) {
          const newStatus = fpData.payment.status || "ACTIVE";

          if (newStatus !== payment.status) {
            const updates: Record<string, unknown> = { status: newStatus };
            if (newStatus === "COMPLETED") {
              updates.paid_at = fpData.payment.paidAt || new Date().toISOString();
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

    // CREATE CRYPTO (USDT) CHARGE
    if (action === "create-crypto" && req.method === "POST") {
      if (!FLOWPAY_API_KEY) {
        return new Response(JSON.stringify({ error: "FLOWPAY_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { cart_snapshot, coupon_id } = body;

      // SERVER-SIDE PRICE VALIDATION
      const { validatedAmount, validatedDiscount, validatedCart, error: validationError } =
        await validateAndCalculatePrice(supabaseAdmin, cart_snapshot, userId, coupon_id);

      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amount = validatedAmount;

      const fpRes = await fetch(`${FLOWPAY_CRYPTO_URL}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": FLOWPAY_API_KEY,
        },
        body: JSON.stringify({
          value: amount,
          description: `Compra Inject Project - ${validatedCart.length} item(s)`,
        }),
      });

      const fpData = await fpRes.json();
      if (!fpRes.ok || !fpData.success) {
        console.error("FlowPay crypto error:", fpData);
        return new Response(JSON.stringify({ error: "Erro ao criar cobrança USDT" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: payment, error: insertError } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          charge_id: fpData.charge.id,
          amount,
          status: "ACTIVE",
          cart_snapshot: validatedCart,
          coupon_id: coupon_id || null,
          discount_amount: validatedDiscount,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Erro ao salvar pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          crypto: fpData.charge.crypto,
          charge_id: fpData.charge.id,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK CRYPTO STATUS
    if (action === "crypto-status" && req.method === "GET") {
      const paymentId = url.searchParams.get("payment_id");
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow users to check their own payments
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

      if (FLOWPAY_API_KEY) {
        const fpRes = await fetch(`${FLOWPAY_CRYPTO_URL}/status?id=${payment.charge_id}`, {
          headers: { "x-api-key": FLOWPAY_API_KEY },
        });

        const fpData = await fpRes.json();
        if (fpRes.ok && fpData.charge) {
          const newStatus = fpData.charge.status || "ACTIVE";

          if (newStatus !== payment.status) {
            const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
            if (newStatus === "COMPLETED") {
              updates.paid_at = fpData.charge.paidAt || new Date().toISOString();
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
