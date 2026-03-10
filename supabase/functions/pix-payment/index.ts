import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MISTICPAY_BASE_URL = "https://api.misticpay.com/api";

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
          .from("product_tutorials")
          .select("tutorial_text, tutorial_file_url")
          .eq("product_id", item.productId)
          .maybeSingle();

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
  const { data: lztCred } = await supabaseAdmin
    .from("system_credentials")
    .select("value")
    .eq("env_key", "LZT_API_TOKEN")
    .maybeSingle();
  const LZT_TOKEN = lztCred?.value || Deno.env.get("LZT_MARKET_TOKEN");

  const itemId = item.lztItemId;
  let price = item.lztPrice;
  let currency = item.lztCurrency || "rub";

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
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ Seu pagamento foi confirmado!\n\n⚠️ Houve um problema ao processar a entrega automática da conta. Nossa equipe irá entregar manualmente em breve.\n\nSe tiver dúvidas, envie uma mensagem aqui neste chat.`,
      });
    }

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
    let accountEmail = loginData?.email || boughtItem?.email || boughtItem?.emailLoginData || "";

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
    await createManualDeliveryTicket(`Exception: ${err?.message || String(err)}`);
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

      // Fetch REAL price from LZT API - never trust client price
      const lztRes = await fetch(`https://api.lzt.market/${encodeURIComponent(lztItemId)}`, {
        headers: { Authorization: `Bearer ${lztToken}`, Accept: "application/json" },
      });
      if (!lztRes.ok) {
        console.error(`LZT API error for item ${lztItemId}:`, lztRes.status);
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Erro ao verificar preço da conta LZT ${lztItemId}` };
      }
      const lztData = await lztRes.json();
      const realLztPrice = Number(lztData?.item?.price) || 0;
      const realLztCurrency = lztData?.item?.price_currency || "rub";
      if (realLztPrice <= 0) {
        return { validatedAmount: 0, validatedDiscount: 0, validatedCart: [], error: `Conta LZT ${lztItemId} não disponível ou sem preço` };
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
      let brlPrice = realLztCurrency === "rub" ? realLztPrice * RUB_TO_BRL : realLztPrice;
      const expectedPrice = Math.round(brlPrice * markup * 100) / 100;
      const MIN_PRICE = 20;
      const finalPrice = expectedPrice < MIN_PRICE ? MIN_PRICE : expectedPrice;
      console.log(`LZT VALIDATED price: itemId=${lztItemId}, apiPrice=${realLztPrice}, clientPrice=${item.lztPrice}, brl=${brlPrice.toFixed(2)}, markup=${markup}, finalPrice=${finalPrice}, game=${gameCategory}`);
      totalAmount += Math.round(finalPrice * 100);
      validatedCart.push({ ...item, price: finalPrice });
      continue;
    }

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

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
      console.log(`Webhook: payment ${payment.id} status ${payment.status} -> ${newStatus}`);

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
          console.log("Webhook: fulfilling order for payment:", payment.id);
          await fulfillOrder(supabaseAdmin, payment);
          await sendDiscordSaleNotification(supabaseAdmin, payment);
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

  // url and action already declared above

  try {
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
