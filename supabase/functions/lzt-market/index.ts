import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LZT_ALLOWED_IMAGE_DOMAINS = ["lzt.market", "api.lzt.market", "s.lzt.market", "img.lzt.market"];
const RETRYABLE_STATUSES = [429, 502, 503, 504];
const RUB_TO_BRL = 0.055;
const USD_TO_BRL = 5.50;
const MIN_PRICE_BRL = 20;
const DEFAULT_MARKUP = 3.0;
const MIN_INACTIVE_DAYS = 30;
const MAX_RAW_PAGES_PER_REQUEST = 12;

type LztItem = Record<string, any>;

function normalizeUnixTimestamp(value: unknown) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed > 1_000_000_000_000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
}

function getLastActivityTimestamp(item: LztItem) {
  return normalizeUnixTimestamp(
    item.account_last_activity || item.riot_last_activity || item.last_activity || item.login_date,
  );
}

function log(level: "INFO" | "WARN" | "ERROR", ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, ctx, msg, ...(data || {}) };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

/**
 * Content-based minimum price: ensures accounts with lots of skins/content
 * are never sold below a fair floor, even if listed cheap on LZT.
 */
function getContentFloorBrl(item: LztItem, gameType?: string) {
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    const vbucks = Math.min(Number(item.fortnite_vbucks || 0), 50000);
    const level = Math.min(Number(item.fortnite_level || 0), 500);
    // ~R$0.35/skin + vbucks value + level bonus
    return skins * 0.35 + vbucks * 0.005 + level * 0.1;
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    const champs = Number(item.riot_lol_champion_count || 0);
    const level = Math.min(Number(item.riot_lol_level || 0), 350);
    return skins * 0.5 + champs * 0.15 + level * 0.1;
  }
  // Valorant
  const skins = Number(item.riot_valorant_skin_count || 0);
  const knives = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  return skins * 0.6 + knives * 5 + level * 0.08;
}

function getDisplayedPriceBrl(item: LztItem, overridePrice?: number, gameType?: string, markup?: number) {
  if (typeof overridePrice === "number" && overridePrice > 0) return overridePrice;

  const activeMarkup = markup || DEFAULT_MARKUP;
  const currency = String(item.price_currency || "rub").toLowerCase();
  const rawPrice = Number(item.price || 0);
  let brl = rawPrice;
  if (currency === "rub") {
    brl = rawPrice * RUB_TO_BRL;
    brl = brl * activeMarkup;
  } else if (currency === "usd") {
    brl = rawPrice * USD_TO_BRL;
    brl = brl * activeMarkup;
  } else {
    // Already BRL — apply a smaller margin (30%) since seller set BRL price directly
    brl = rawPrice * 1.30;
  }
  let final = brl;

  // Enforce content-based floor so cheap listings with lots of content get a fair price
  const contentFloor = getContentFloorBrl(item, gameType);
  if (final < contentFloor) final = contentFloor;

  return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : Math.round(final * 100) / 100;
}

function getLolFairPriceCeiling(item: LztItem) {
  const skinCount = Number(item.riot_lol_skin_count || 0);
  const champCount = Number(item.riot_lol_champion_count || 0);
  const level = Math.min(Number(item.riot_lol_level || 0), 350);
  const blueEssence = Math.min(Number(item.riot_lol_wallet_blue || 0), 50000);
  const orangeEssence = Math.min(Number(item.riot_lol_wallet_orange || 0), 5000);
  const mythicEssence = Math.min(Number(item.riot_lol_wallet_mythic || 0), 200);
  const riotPoints = Math.min(Number(item.riot_lol_wallet_riot || 0), 10000);
  const rank = String(item.riot_lol_rank || "").toLowerCase();

  let rankBonus = 0;
  if (rank.includes("challenger")) rankBonus = 1200;
  else if (rank.includes("grandmaster")) rankBonus = 900;
  else if (rank.includes("master")) rankBonus = 700;
  else if (rank.includes("diamond")) rankBonus = 400;
  else if (rank.includes("emerald")) rankBonus = 250;
  else if (rank.includes("platinum")) rankBonus = 180;
  else if (rank.includes("gold")) rankBonus = 120;
  else if (rank.includes("silver")) rankBonus = 80;
  else if (rank.includes("bronze")) rankBonus = 40;

  const estimatedValue =
    skinCount * 70 +
    champCount * 5 +
    level * 2 +
    blueEssence * 0.01 +
    orangeEssence * 0.08 +
    mythicEssence * 6 +
    riotPoints * 0.03 +
    rankBonus;

  return Math.max(Math.round(estimatedValue), 120);
}

function getValorantFairPriceCeiling(item: LztItem) {
  const skinCount = Number(item.riot_valorant_skin_count || 0);
  const knifeCount = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  const vp = Math.min(Number(item.riot_valorant_wallet_vp || item.riot_valorant_vp || 0), 20000);
  const rp = Math.min(Number(item.riot_valorant_wallet_rp || 0), 10000);
  const rankNum = Number(item.riot_valorant_rank || 0);
  const lastRank = Number(item.riot_valorant_last_rank || 0);
  const effectiveRank = Math.max(rankNum, lastRank);

  // Rank bonus — more generous to reflect real market value
  let rankBonus = 0;
  if (effectiveRank >= 27) rankBonus = 2000;       // Radiant
  else if (effectiveRank >= 24) rankBonus = 1200;   // Immortal
  else if (effectiveRank >= 21) rankBonus = 600;    // Ascendant
  else if (effectiveRank >= 18) rankBonus = 350;    // Diamond
  else if (effectiveRank >= 15) rankBonus = 200;    // Platinum
  else if (effectiveRank >= 12) rankBonus = 120;    // Gold
  else if (effectiveRank >= 9) rankBonus = 60;      // Silver

  // Increased skin value from 12 to 25 to stop filtering 85% of items
  const estimatedValue =
    skinCount * 25 +
    knifeCount * 120 +
    level * 1.2 +
    vp * 0.02 +
    rp * 0.03 +
    rankBonus;

  return Math.max(Math.round(estimatedValue), 150);
}

function getFortniteFairPriceCeiling(item: LztItem) {
  const skinCount = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
  const vbucks = Math.min(Number(item.fortnite_vbucks || 0), 50000);
  const level = Math.min(Number(item.fortnite_level || 0), 500);

  const estimatedValue =
    skinCount * 15 +
    vbucks * 0.02 +
    level * 1;

  return Math.max(Math.round(estimatedValue), 60);
}

function shouldKeepItem(item: LztItem, gameType: string, _displayedPriceBrl: number) {
  if (item.buyer) return false;
  if (item.canBuyItem === false) return false;

  // Require minimum 30 days of inactivity for account security
  const rawLastActivity = Number(item.account_last_activity || item.riot_last_activity || item.last_activity || item.login_date || 0);
  const lastActivity = rawLastActivity > 1_000_000_000_000 ? Math.floor(rawLastActivity / 1000) : rawLastActivity;
  if (lastActivity > 0) {
    const daysSinceActive = (Date.now() / 1000 - lastActivity) / 86400;
    if (daysSinceActive < 30) return false;
  }

  // Minimum 3 skins per game
  const isValorant = gameType === "riot" || gameType === "valorant";
  if (isValorant) {
    const skins = Number(item.riot_valorant_skin_count || 0);
    if (skins < 3) return false;
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    if (skins < 3) return false;
  }
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    if (skins < 3) return false;
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Helper: authenticate user (returns null if not authenticated)
    const getAuthUser = async () => {
      if (!authHeader?.startsWith("Bearer ")) return null;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error,
      } = await supabaseUser.auth.getUser();
      return error ? null : user;
    };

    // Fetch LZT token from system_credentials table
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch token + config in parallel to reduce latency
    const [credRow, lztConfigRow] = await Promise.all([
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "LZT_API_TOKEN").maybeSingle(),
      supabaseAdmin.from("lzt_config").select("max_fetch_price, currency, markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft").limit(1).maybeSingle(),
    ]);

    const token = credRow.data?.value || Deno.env.get("LZT_MARKET_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "LZT token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const itemId = url.searchParams.get("item_id");
    const gameType = url.searchParams.get("game_type") || "riot";

    // IMAGE PROXY: Proxy image requests to bypass CORS (requires auth)
    if (action === "image-proxy") {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "url parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow proxying from known LZT domains
      try {
        const parsedUrl = new URL(imageUrl);
        if (!LZT_ALLOWED_IMAGE_DOMAINS.some((domain) => parsedUrl.hostname.endsWith(domain))) {
          return new Response(JSON.stringify({ error: "Domain not allowed" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(imageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Image fetch failed", status: response.status }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageData = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "image/png";

      return new Response(imageData, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // FAST-BUY: Purchase an account - ADMIN ONLY (requires auth)
    if (action === "fast-buy" && req.method === "POST") {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // SECURITY: admin only
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { item_id, price, currency } = body;

      if (!item_id || !price) {
        return new Response(JSON.stringify({ error: "item_id and price required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buyUrl = `https://api.lzt.market/${encodeURIComponent(item_id)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;
      console.log("Fast-buy:", buyUrl);

      const response = await fetch(buyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();
      console.log("Fast-buy response:", response.status, JSON.stringify(data).substring(0, 500));

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "LZT fast-buy failed", status: response.status, detail: data }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHANGE PRICE: Change price of an account - ADMIN ONLY
    if (action === "change-price" && req.method === "POST") {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { item_id: priceItemId, price: newPrice, currency: priceCurrency } = body;

      if (!priceItemId || !newPrice) {
        return new Response(JSON.stringify({ error: "item_id and price required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const editUrl = `https://api.lzt.market/${encodeURIComponent(priceItemId)}/edit?price=${encodeURIComponent(newPrice)}${priceCurrency ? `&currency=${encodeURIComponent(priceCurrency)}` : ""}`;
      console.log("Change price:", editUrl);

      const editResponse = await fetch(editUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const editData = await editResponse.json();
      console.log("Change price response:", editResponse.status, JSON.stringify(editData).substring(0, 500));

      if (!editResponse.ok) {
        return new Response(
          JSON.stringify({ error: "LZT change-price failed", status: editResponse.status, detail: editData }),
          { status: editResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify(editData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // lzt_config already fetched in parallel at startup
    const lztConfig = lztConfigRow.data;

    // Compute per-game markup from DB (used for both list and detail)
    let activeMarkup = DEFAULT_MARKUP;
    if (gameType === "fortnite" && lztConfig?.markup_fortnite) activeMarkup = Number(lztConfig.markup_fortnite);
    else if (gameType === "lol" && lztConfig?.markup_lol) activeMarkup = Number(lztConfig.markup_lol);
    else if (gameType === "minecraft" && lztConfig?.markup_minecraft) activeMarkup = Number(lztConfig.markup_minecraft);
    else if ((gameType === "riot" || gameType === "valorant") && lztConfig?.markup_valorant) activeMarkup = Number(lztConfig.markup_valorant);
    else if (lztConfig?.markup_multiplier) activeMarkup = Number(lztConfig.markup_multiplier);

    // DETAIL: Get single item
    let apiUrl: string;
    if (action === "detail" && itemId) {
      apiUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}`;
    } else {
      // LIST: accounts with filters
      const params = new URLSearchParams();
      const allowedParams = [
        "page", "pmin", "pmax", "title", "order_by", "currency",
        "nsb",  // not sold before
        "rmin", "rmax", "last_rmin", "last_rmax", "previous_rmin", "previous_rmax",
        "valorant_level_min", "valorant_level_max",
        "valorant_smin", "valorant_smax",
        "valorant_knife_min", "valorant_knife_max",
        "vp_min", "vp_max", "rp_min", "rp_max",
        "fa_min", "fa_max",
        "inv_min", "inv_max",
        "knife", "nsb",
        "amin", "amax",
        // LoL params
        "lol_level_min", "lol_level_max",
        "lol_smin", "lol_smax",
        "champion_min", "champion_max",
        "win_rate_min", "win_rate_max",
        "blue_min", "blue_max",
        "orange_min", "orange_max",
        "mythic_min", "mythic_max",
        "riot_min", "riot_max",
      ];

      for (const p of allowedParams) {
        const val = url.searchParams.get(p);
        if (val) params.set(p, val);
      }

      const arrayParams = [
        "weaponSkin[]", "buddy[]", "agent[]", "valorant_region[]",
        "valorant_rank_type[]", "email_type[]", "country[]",
        "champion[]", "skin[]", "lol_rank[]", "lol_region[]",
        "not_country[]",
      ];
      for (const p of arrayParams) {
        const vals = url.searchParams.getAll(p);
        for (const v of vals) {
          params.append(p, v);
        }
      }

      // Convert user-provided BRL price filters to seller currency
      const userPmin = params.get("pmin");
      if (userPmin) {
        const brlMin = Number(userPmin);
        if (brlMin > 0) {
          if (brlMin <= MIN_PRICE_BRL) {
            params.delete("pmin");
          } else {
            params.set("pmin", String(Math.floor(brlMin / activeMarkup)));
          }
        }
      }

      const userPmax = params.get("pmax");
      if (userPmax) {
        const brlMax = Number(userPmax);
        if (brlMax > 0) {
          params.set("pmax", String(Math.ceil((brlMax / activeMarkup) * 1.1)));
        } else {
          params.delete("pmax");
        }
      } else {
        // Default pmax: R$2000 BRL equivalent to keep API fast while showing plenty of accounts
        const defaultPmaxSeller = Math.ceil(2000 / activeMarkup);
        params.set("pmax", String(defaultPmaxSeller));
      }

      if (gameType === "fortnite") {
        // Fortnite-specific params
        const fortniteParams = ["vbmin", "vbmax", "smin", "smax", "eg"];
        for (const p of fortniteParams) {
          const val = url.searchParams.get(p);
          if (val) params.set(p, val);
        }
        // Remove Valorant/LoL-specific params that don't apply
        params.delete("valorant_smin");
        params.delete("valorant_smax");
        params.delete("lol_smin");
        params.delete("lol_smax");
        params.delete("champion_min");
        apiUrl = `https://api.lzt.market/fortnite?${params.toString()}`;
      } else if (gameType === "minecraft") {
        // Minecraft-specific params
        const mcParams = [
          "java", "bedrock", "dungeons", "legends", "change_nickname",
          "capes_min", "capes_max", "hypixel_ban", "level_hypixel_min", "level_hypixel_max",
          "achievement_hypixel_min", "achievement_hypixel_max", "minecoins_min", "minecoins_max",
          "nickname_length_min", "nickname_length_max",
        ];
        for (const p of mcParams) {
          const val = url.searchParams.get(p);
          if (val) params.set(p, val);
        }
        const mcArrayParams = ["rank_hypixel[]", "capes[]", "country[]"];
        for (const p of mcArrayParams) {
          const vals = url.searchParams.getAll(p);
          for (const v of vals) params.append(p, v);
        }
        // Remove Valorant/LoL-specific params
        params.delete("valorant_smin");
        params.delete("valorant_smax");
        params.delete("lol_smin");
        params.delete("lol_smax");
        params.delete("champion_min");
        apiUrl = `https://api.lzt.market/minecraft?${params.toString()}`;
      } else if (gameType === "lol") {
        // LoL uses /riot endpoint but must NOT have any Valorant-specific params
        // Per LZT API docs: LoL uses lol_smin, lol_region[], lol_rank[], champion[]
        params.delete("valorant_smin");
        params.delete("valorant_smax");
        params.delete("valorant_level_min");
        params.delete("valorant_level_max");
        params.delete("valorant_knife_min");
        params.delete("valorant_knife_max");
        params.delete("vp_min");
        params.delete("vp_max");
        params.delete("rp_min");
        params.delete("rp_max");
        params.delete("fa_min");
        params.delete("fa_max");
        params.delete("rmin");
        params.delete("rmax");
        params.delete("last_rmin");
        params.delete("last_rmax");
        params.delete("previous_rmin");
        params.delete("previous_rmax");
        params.delete("knife");
        params.delete("amin");
        params.delete("amax");
        params.delete("inv_min");
        params.delete("inv_max");
        apiUrl = `https://api.lzt.market/riot?${params.toString()}`;
      } else {
        // Valorant: remove LoL-specific params only
        params.delete("lol_smin");
        params.delete("lol_smax");
        params.delete("lol_level_min");
        params.delete("lol_level_max");
        params.delete("champion_min");
        params.delete("champion_max");
        apiUrl = `https://api.lzt.market/riot?${params.toString()}`;
      }
    }

    console.log("Fetching:", apiUrl);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
        console.log(`LZT retry attempt ${attempt + 1} after ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
      response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (response.ok || !RETRYABLE_STATUSES.includes(response.status)) break;
      console.warn(`LZT API attempt ${attempt + 1}: ${response.status}`);
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No response";
      const status = response?.status || 502;
      console.error("LZT API error after retries:", status, errorText);
      return new Response(
        JSON.stringify({ error: "LZT API error", status, detail: errorText }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    if (action !== "detail") {
      const currentPage = Math.max(1, Number(data.page || url.searchParams.get("page") || 1));
      const perPage = Math.max(1, Number(data.perPage || (Array.isArray(data.items) ? data.items.length : 0) || 1));
      const totalItems = Math.max(0, Number(data.totalItems || 0));

      data.page = currentPage;
      data.perPage = perPage;
      data.totalItems = totalItems;
      data.hasNextPage = totalItems > currentPage * perPage;
    }
 
    // For LIST responses, strip heavy fields to reduce egress (~80% reduction per item)
    if (action !== "detail" && data.items && Array.isArray(data.items)) {
      const STRIP_FIELDS = [
        "description", "description_en", "title_en",
        "copyFormatData", "feedback_data", "category",
        "canViewLoginData", "canViewTempEmail", "canUpdateItemStats",
        "canReportItem", "canViewItemViews", "canManagePublicTag",
        "canViewEmailLoginData", "showGetEmailCodeButton", "canOpenItem",
        "canCloseItem", "canEditItem", "canDeleteItem", "canStickItem",
        "canUnstickItem", "canBumpItem", "canNotBumpItemReason",
        "canValidateAccount", "canResellItem", "canBuyItem",
        "buyer", "isPersonalAccount", "guarantee", "extended_guarantee",
        "isSmallExf", "auto_bump_period",
        "pending_deletion_date", "update_stat_date",
      ];

      const itemIds = data.items.map((item: LztItem) => String(item.item_id)).filter(Boolean);
      const overrideMap = new Map<string, number>();

      if (itemIds.length > 0) {
        const { data: overridesData } = await supabaseAdmin
          .from("lzt_price_overrides")
          .select("lzt_item_id, custom_price_brl")
          .in("lzt_item_id", itemIds);

        if (overridesData) {
          for (const override of overridesData) {
            overrideMap.set(override.lzt_item_id, Number(override.custom_price_brl));
          }
        }
      }

      const beforeCount = data.items.length;
      let filteredByInactivity = 0, filteredByPrice = 0, filteredByOther = 0;
      data.items = data.items.filter((item: LztItem) => {
        // Skip sold/closed/deleted items
        if (item.item_state && item.item_state !== "active") { filteredByOther++; return false; }
        if (item.buyer) { filteredByOther++; return false; }
        if (item.canBuyItem === false) { filteredByOther++; return false; }
        
        const displayedPriceBrl = getDisplayedPriceBrl(item, overrideMap.get(String(item.item_id)), gameType, activeMarkup);
        
        // shouldKeepItem handles inactivity, fair-price, and quality checks for all games
        const isValorant = gameType === "riot" || gameType === "valorant";
        if (!shouldKeepItem(item, gameType, displayedPriceBrl)) {
          if (isValorant) {
            const rawLastActivity = Number(item.account_last_activity || item.riot_last_activity || item.last_activity || item.login_date || 0);
            const lastActivity = rawLastActivity > 1_000_000_000_000 ? Math.floor(rawLastActivity / 1000) : rawLastActivity;
            const nowSec = Math.floor(Date.now() / 1000);
            if (lastActivity > 0 && (nowSec - lastActivity) < 30 * 86400) {
              filteredByInactivity++;
            } else {
              filteredByPrice++;
            }
          }
          return false;
        }
        return true;
      });

      log("INFO", "lzt-market", "Filtered market items", {
        gameType,
        beforeCount,
        afterCount: data.items.length,
        ...(gameType === "riot" || gameType === "valorant" ? { filteredByInactivity, filteredByPrice, filteredByOther } : {}),
      });

      for (const item of data.items) {
        item.price_brl = getDisplayedPriceBrl(item, overrideMap.get(String(item.item_id)), gameType, activeMarkup);

        // Strip heavy fields
        for (const field of STRIP_FIELDS) delete item[field];

        // Trim valorantInventory to max 12 items per category (enough for preview)
        if (item.valorantInventory) {
          const inv = item.valorantInventory;
          const trimmed: Record<string, any> = {};
          for (const [key, val] of Object.entries(inv)) {
            if (val && typeof val === "object") {
              const entries = Object.entries(val);
              if (entries.length > 12) {
                trimmed[key] = Object.fromEntries(entries.slice(0, 12));
              } else {
                trimmed[key] = val;
              }
            } else {
              trimmed[key] = val;
            }
          }
          item.valorantInventory = trimmed;
        }
      }
    }

    // For detail action, also add price_brl (keep full data)
    if (action === "detail" && data.item) {
      // SECURITY: reject sold/unavailable accounts on detail too
      const itemState = data.item.item_state;
      if (data.item.buyer || itemState === "closed" || itemState === "deleted") {
        return new Response(
          JSON.stringify({ error: "Account already sold", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (data.item.canBuyItem === false || (itemState && itemState !== "active")) {
        return new Response(
          JSON.stringify({ error: "Account unavailable", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Check for price override first
      const detailItemId = String(data.item.item_id);
      const { data: overrideRow } = await supabaseAdmin
        .from("lzt_price_overrides")
        .select("custom_price_brl")
        .eq("lzt_item_id", detailItemId)
        .maybeSingle();

      const overridePrice = overrideRow && Number(overrideRow.custom_price_brl) > 0
        ? Number(overrideRow.custom_price_brl)
        : undefined;

      data.item.price_brl = getDisplayedPriceBrl(data.item, overridePrice, gameType, activeMarkup);

      if (!shouldKeepItem(data.item, gameType, data.item.price_brl)) {
        return new Response(
          JSON.stringify({ error: "Account does not meet quality filters", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Add cache headers: list responses cached 2 min, detail cached 30s
    const cacheMaxAge = action === "detail" ? 30 : 120;

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}`,
      },
    });
  } catch (error: any) {
    log("ERROR", "lzt-market", "Edge function error", { error: error?.message || String(error) });
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
