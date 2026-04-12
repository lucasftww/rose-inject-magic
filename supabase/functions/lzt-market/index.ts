import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hasLztItemBuyerAssigned,
  isLztItemStateAwaiting,
  isLztItemStateSoldOrRemoved,
} from "../_shared/lztItemGuards.ts";
import { errorMessage } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LZT_ALLOWED_IMAGE_DOMAINS = [
  "lzt.market", "api.lzt.market", "s.lzt.market", "img.lzt.market",
  "ddragon.leagueoflegends.com", "fortnite-api.com", "mineskin.eu",
  "akamaihd.net", "capes.dev",
];
const RETRYABLE_STATUSES = [429, 502, 503, 504];
let RUB_TO_BRL = 0.055; // Updated fallback
let USD_TO_BRL = 5.16; // Updated fallback
let lastFxFetch = 0;

async function updateRates() {
  const now = Date.now();
  if (now - lastFxFetch < 1000 * 60 * 60) return; // Cache for 1 hour
  try {
    const fxRes = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,RUB-BRL");
    if (fxRes.ok) {
      const fxData = await fxRes.json();
      const usdBid = Number(fxData?.USDBRL?.bid);
      const rubBid = Number(fxData?.RUBBRL?.bid);
      
      if (usdBid > 0) USD_TO_BRL = usdBid;
      if (rubBid > 0) RUB_TO_BRL = rubBid;
      
      if (usdBid > 0 || rubBid > 0) lastFxFetch = now;
      console.log(`Rates updated: USD=${USD_TO_BRL}, RUB=${RUB_TO_BRL}`);
    }
  } catch (e) {
    console.warn("FX fetch failed, using fallbacks:", e);
  }
}
const MIN_PRICE_BRL = 20;
const DEFAULT_MARKUP = 3.0;
const MIN_INACTIVE_DAYS = 30;
/** Fortnite: mínimo de dias sem atividade na conta (parâmetro LZT `daybreak`). */
const FORTNITE_MIN_INACTIVE_DAYS = 90;

/** Resposta LZT por jogo — dezenas de campos opcionais; `any` evita mapa gigante. */
type LztItem = Record<string, any>;

function log(level: "INFO" | "WARN" | "ERROR", ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, ctx, msg, ...(data || {}) };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function normalizeCurrency(currency?: string | null) {
  const normalized = String(currency || "rub").trim().toLowerCase();
  if (normalized === "usd" || normalized === "brl") return normalized;
  return "rub";
}

function convertBrlToSellerPrice(brlAmount: number, currency: string, markup: number) {
  if (!Number.isFinite(brlAmount) || brlAmount <= 0) return null;

  if (currency === "usd") {
    return Math.max(1, Math.ceil(brlAmount / (USD_TO_BRL * Math.max(markup, 1))));
  }

  if (currency === "brl") {
    // Listagens em BRL na LZT: inverter o mesmo multiplicador usado em `getDisplayedPriceBrl` (markup admin).
    return Math.max(1, Math.ceil(brlAmount / Math.max(markup, 1)));
  }


  return Math.max(1, Math.ceil(brlAmount / (RUB_TO_BRL * Math.max(markup, 1))));
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Content-based minimum price: ensures accounts with lots of skins/content
 * are never sold below a fair floor, even if listed cheap on LZT.
 */
function getContentFloorBrl(item: LztItem, gameType?: string) {
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    const vbucks = Math.min(Number(item.fortnite_vbucks || item.fortnite_balance || 0), 50000);
    const level = Math.min(Number(item.fortnite_level || 0), 500);
    return skins * 0.35 + vbucks * 0.005 + level * 0.1;
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    const champs = Number(item.riot_lol_champion_count || 0);
    const level = Math.min(Number(item.riot_lol_level || 0), 350);
    return skins * 0.5 + champs * 0.15 + level * 0.1;
  }
  if (gameType === "minecraft") {
    const capes = Number(item.minecraft_capes_count || 0);
    const level = Math.min(Number(item.minecraft_hypixel_level || 0), 300);
    const hasJava = Number(item.minecraft_java || 0);
    const hasBedrock = Number(item.minecraft_bedrock || 0);
    return capes * 2 + level * 0.1 + hasJava * 3 + hasBedrock * 3;
  }
  // Valorant
  const skins = Number(item.riot_valorant_skin_count || 0);
  const knives = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  return skins * 0.6 + knives * 5 + level * 0.08;
}

/**
 * Content-based CEILING: prevents overpricing low-quality accounts.
 * An unranked account with 12 basic skins should NOT cost R$225.
 * The ceiling reflects the realistic resale value of the account's content.
 */
function getContentCeilingBrl(item: LztItem, gameType?: string) {
  if (gameType === "fortnite") {
    const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
    const vbucks = Math.min(Number(item.fortnite_vbucks || item.fortnite_balance || 0), 50000);
    const level = Math.min(Number(item.fortnite_level || 0), 999);
    // R$10/skin (OG/rare skins worth much more) + vbucks value + level bonus
    const ceiling = skins * 10 + vbucks * 0.02 + level * 0.5;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  if (gameType === "lol") {
    const skins = Number(item.riot_lol_skin_count || 0);
    const champs = Number(item.riot_lol_champion_count || 0);
    const level = Math.min(Number(item.riot_lol_level || 0), 500);
    const rank = String(item.riot_lol_rank || "").toUpperCase();
    let ceiling = skins * 2.5 + champs * 0.8 + level * 0.3;
    // Rank bonus
    if (rank.includes("MASTER") || rank.includes("GRANDMASTER") || rank.includes("CHALLENGER")) ceiling += 120;
    else if (rank.includes("DIAMOND")) ceiling += 60;
    else if (rank.includes("EMERALD")) ceiling += 40;
    else if (rank.includes("PLATINUM")) ceiling += 25;
    else if (rank.includes("GOLD")) ceiling += 15;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  if (gameType === "minecraft") {
    const capes = Number(item.minecraft_capes_count || 0);
    const level = Math.min(Number(item.minecraft_hypixel_level || 0), 300);
    const hasJava = Number(item.minecraft_java || 0);
    const hasBedrock = Number(item.minecraft_bedrock || 0);
    const hasDungeons = Number(item.minecraft_dungeons || 0);
    const hasLegends = Number(item.minecraft_legends || 0);
    let ceiling = capes * 15 + level * 0.5 + hasJava * 20 + hasBedrock * 15 + hasDungeons * 10 + hasLegends * 10;
    const rankStr = String(item.minecraft_hypixel_rank || "").toUpperCase();
    if (rankStr.includes("MVP+")) ceiling += 40;
    else if (rankStr.includes("MVP")) ceiling += 25;
    else if (rankStr.includes("VIP+")) ceiling += 15;
    else if (rankStr.includes("VIP")) ceiling += 8;
    return Math.max(ceiling, MIN_PRICE_BRL);
  }
  // Valorant
  const skins = Number(item.riot_valorant_skin_count || 0);
  const knives = Number(item.riot_valorant_knife || item.riot_valorant_knife_count || 0);
  const agents = Number(item.riot_valorant_agent_count || 0);
  const level = Math.min(Number(item.riot_valorant_level || 0), 500);
  const rank = Number(item.riot_valorant_rank || 0);
  const vp = Number(item.riot_valorant_wallet_vp || 0);
  const invValue = Number(item.riot_valorant_inventory_value || 0);

  let ceiling = skins * 5 + knives * 30 + agents * 1.5 + level * 0.15 + vp * 0.01;
  if (invValue > 0) ceiling += invValue * 0.003;

  if (rank >= 27) ceiling += 150;
  else if (rank >= 24) ceiling += 80;
  else if (rank >= 21) ceiling += 50;
  else if (rank >= 18) ceiling += 35;
  else if (rank >= 15) ceiling += 20;
  else if (rank >= 12) ceiling += 10;

  return Math.max(ceiling, MIN_PRICE_BRL);
}

/**
 * Final sale price in BRL for storefront + checkout.
 * - Respects per-game `markup` from `lzt_config` (must not be silently overridden by content ceiling).
 * - `lzt_config.max_fetch_price` is **only** used to bound the LZT list `pmax` (which listings we fetch), not to
 *   flatten every card to the same displayed price (that broke sorting and made unrelated accounts share one price).
 */
function getDisplayedPriceBrl(
  item: LztItem,
  overridePrice?: number,
  gameType?: string,
  markup?: number,
) {
  if (typeof overridePrice === "number" && overridePrice > 0) return overridePrice;

  const activeMarkup = markup || DEFAULT_MARKUP;
  const currency = String(item.price_currency || "rub").toLowerCase();
  const rawPrice = Number(item.price || 0);

  let costBrl: number;
  /** Pure multiplier result before content anti-gouging / floors (used so ceiling never erases admin markup). */
  let rawMarkedUp: number;

  if (currency === "rub") {
    costBrl = rawPrice * RUB_TO_BRL;
    rawMarkedUp = costBrl * activeMarkup;
  } else if (currency === "usd") {
    costBrl = rawPrice * USD_TO_BRL;
    rawMarkedUp = costBrl * activeMarkup;
  } else {
    // BRL (preço do vendedor já em reais): aplicar o mesmo `activeMarkup` que RUB/USD — antes era 2× fixo e ignorava o admin.
    costBrl = rawPrice;
    rawMarkedUp = rawPrice * activeMarkup;
  }

  let final = rawMarkedUp;

  // Enforce content-based floor so cheap listings with lots of content get a fair price
  const contentFloor = getContentFloorBrl(item, gameType);
  if (final < contentFloor) final = contentFloor;

  // Content ceiling: only cap *above* what markup already allows — never shave a high multiplier down
  // (this was the root cause of e.g. Fortnite 20× not appearing in `price_brl`).
  const contentCeiling = getContentCeilingBrl(item, gameType);
  const effectiveCeiling = Math.max(contentCeiling, rawMarkedUp);
  if (final > effectiveCeiling) final = effectiveCeiling;

  // Ensure minimum 50% margin over cost
  const minMarginPrice = costBrl * 2.0;
  if (final < minMarginPrice) final = minMarginPrice;

  const MIN_PROFIT_BRL = 20.0;
  const safeProfitPrice = costBrl + MIN_PROFIT_BRL;
  if (final < safeProfitPrice) final = safeProfitPrice;

  return final < MIN_PRICE_BRL ? MIN_PRICE_BRL : Math.round(final * 100) / 100;
}


// Fair price ceiling functions kept for potential future use in filtering overpriced items

/** Se a API devolver explicitamente que a conta já foi vendida antes no LZT, removemos da lista/detalhe. */
function itemFailsNotSoldBeforePolicy(item: LztItem): boolean {
  const o = item as Record<string, unknown>;
  const nsb = o.not_sold_before ?? o.notSoldBefore;
  if (nsb === false || nsb === 0 || nsb === "0") return true;
  const sb = o.sold_before ?? o.soldBefore;
  if (sb === true || sb === 1 || sb === "1") return true;
  return false;
}

/**
 * GET /{item_id} costuma omitir agregados (`riot_lol_skin_count`, etc.) que vêm na listagem,
 * mas traz `lolInventory` / `valorantInventory`. Sem isto, `shouldKeepItem` reprova o detalhe com 410.
 */
function enrichDetailItemFromNestedInventory(item: LztItem, gameType: string) {
  const gt = String(gameType || "").toLowerCase();

  const countLoLInventoryField = (raw: unknown): number => {
    if (raw == null) return 0;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) return 0;
      try {
        return countLoLInventoryField(JSON.parse(t));
      } catch {
        return 0;
      }
    }
    if (Array.isArray(raw)) return raw.filter((x) => x != null && x !== "").length;
    if (typeof raw === "object") return Object.keys(raw as Record<string, unknown>).length;
    return 0;
  };

  const valorantWeaponSkinCount = (inv: unknown): number => {
    if (!inv || typeof inv !== "object") return 0;
    const ws = (inv as Record<string, unknown>).WeaponSkins;
    if (ws == null) return 0;
    if (Array.isArray(ws)) return ws.filter((x) => x != null && x !== "").length;
    if (typeof ws === "object") return Object.keys(ws as Record<string, unknown>).length;
    return 0;
  };

  if (gt === "lol") {
    const inv = item.lolInventory;
    if (inv && typeof inv === "object") {
      const o = inv as Record<string, unknown>;
      const skinN = countLoLInventoryField(o.Skin);
      const champN = countLoLInventoryField(o.Champion);
      const curSkins = Number(item.riot_lol_skin_count || 0);
      const curChamps = Number(item.riot_lol_champion_count || 0);
      if (skinN > curSkins) item.riot_lol_skin_count = skinN;
      if (champN > curChamps) item.riot_lol_champion_count = champN;
    }
  }

  if (gt === "riot" || gt === "valorant") {
    const n = valorantWeaponSkinCount(item.valorantInventory);
    const cur = Number(item.riot_valorant_skin_count || 0);
    if (n > cur) item.riot_valorant_skin_count = n;
  }
}

function shouldKeepItem(
  item: LztItem,
  gameType: string,
  _displayedPriceBrl: number,
  opts?: { skipValueGate?: boolean; skipMinSkins?: boolean; skipCanBuyCheck?: boolean },
) {
  if (hasLztItemBuyerAssigned(item)) return false;
  if (!opts?.skipCanBuyCheck && item.canBuyItem === false) return false;
  if (itemFailsNotSoldBeforePolicy(item)) return false;

  // ── Quality gates: minimum content thresholds ──
  if (!opts?.skipMinSkins) {
    const isValorant = gameType === "riot" || gameType === "valorant";
    if (isValorant) {
      const skins = Number(item.riot_valorant_skin_count || 0);
      if (skins < 5) return false;
    }
    if (gameType === "lol") {
      const skins = Number(item.riot_lol_skin_count || 0);
      if (skins < 10) return false;
    }
    if (gameType === "fortnite") {
      const skins = Number(item.fortnite_skin_count || item.fortnite_outfit_count || 0);
      if (skins < 10) return false;
    }
  }

  if (opts?.skipValueGate) return true;

  // ── Value gate: reject overpriced accounts with poor content ──
  // If the content ceiling (fair value) is less than a threshold of the raw cost,
  // the account is garbage listed at an inflated price — skip it.
  // Fortnite uses a lower threshold (0.2) because OG/rare skins have unpredictable value.
  const currency = String(item.price_currency || "rub").toLowerCase();
  const rawPrice = Number(item.price || 0);
  const costBrl = currency === "rub" ? rawPrice * RUB_TO_BRL
    : currency === "usd" ? rawPrice * USD_TO_BRL
    : rawPrice;
  if (costBrl > 0) {
    const contentCeiling = getContentCeilingBrl(item, gameType);
    const valueGateRatio = gameType === "fortnite" ? 0.2 : 0.4;
    if (contentCeiling < costBrl * valueGateRatio) return false;
  }

  return true;
}

const globalLztCache = new Map<string, { data: unknown; expiry: number }>();

function lztTokenFromCredentialRows(rows: unknown[] | null | undefined): string {
  const byLztKey = new Map<string, string>();
  for (const r of rows || []) {
    const row = r as { env_key?: string; value?: string };
    const k = String(row?.env_key || "");
    const v = String(row?.value || "").trim();
    if (k && v) byLztKey.set(k, v);
  }
  return byLztKey.get("LZT_API_TOKEN") || byLztKey.get("LZT_MARKET_TOKEN") || "";
}

/** Short TTL: image-proxy runs very often; avoid hitting DB on every <img> request. */
let lztTokenMemoryCache: { token: string; expiry: number } | null = null;
const LZT_TOKEN_MEMORY_TTL_MS = 5 * 60 * 1000;

async function resolveLztTokenMinimal(supabaseUrl: string, serviceRoleKey: string): Promise<string> {
  const now = Date.now();
  if (lztTokenMemoryCache && lztTokenMemoryCache.expiry > now) {
    return lztTokenMemoryCache.token;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await admin
    .from("system_credentials")
    .select("env_key, value")
    .in("env_key", ["LZT_API_TOKEN", "LZT_MARKET_TOKEN"]);
  const fromDb = lztTokenFromCredentialRows(data);
  const token =
    fromDb ||
    Deno.env.get("LZT_MARKET_TOKEN")?.trim() ||
    Deno.env.get("LZT_API_TOKEN")?.trim() ||
    "";
  if (token) {
    lztTokenMemoryCache = { token, expiry: now + LZT_TOKEN_MEMORY_TTL_MS };
  }
  return token;
}

function rememberLztToken(token: string) {
  if (!token) return;
  lztTokenMemoryCache = { token, expiry: Date.now() + LZT_TOKEN_MEMORY_TTL_MS };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("lzt-market: missing SUPABASE_URL, service role, or anon/publishable key");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // IMAGE PROXY FIRST: skip FX rates + lzt_config (many parallel <img> hits per page).
    if (action === "image-proxy") {
      const token = await resolveLztTokenMinimal(supabaseUrl, serviceRoleKey);
      if (!token) {
        console.error("LZT token missing: configure system_credentials or LZT_MARKET_TOKEN / LZT_API_TOKEN secret");
        return new Response(JSON.stringify({ error: "LZT token not configured" }), {
          status: 500,
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

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
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

      const lztImageHosts = ["lzt.market", "api.lzt.market", "s.lzt.market", "img.lzt.market"];
      const needsLztBearer = lztImageHosts.some((h) => parsedUrl.hostname.endsWith(h));
      const upstreamHeaders: Record<string, string> = { Accept: "image/*,*/*" };
      if (needsLztBearer) upstreamHeaders.Authorization = `Bearer ${token}`;

      const response = await fetch(imageUrl, { headers: upstreamHeaders });

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
          "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
        },
      });
    }

    const authHeader = req.headers.get("Authorization");

    // Helper: authenticate user (returns null if not authenticated)
    const getAuthUser = async () => {
      try {
        if (!authHeader?.startsWith("Bearer ")) return null;
        const supabaseUser = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data, error } = await supabaseUser.auth.getUser();
        if (error || !data) return null;
        return data.user;
      } catch (e) {
        console.warn("getAuthUser failed:", e);
        return null;
      }
    };

    // Fetch LZT token from system_credentials table
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Update rates and fetch configs in parallel with overall timeout
    try {
      console.log("Starting backend fetch tasks...");
      await Promise.race([
        updateRates(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Rates timeout")), 5000))
      ]).catch(e => console.warn("Rates fetch timed out or failed:", e));
    } catch (e) { 
      console.warn("Critical error in rate update loop:", e);
    }

    const [lztCredsRes, lztConfigRow] = await Promise.all([
      supabaseAdmin.from("system_credentials").select("env_key, value").in("env_key", ["LZT_API_TOKEN", "LZT_MARKET_TOKEN"]),
      supabaseAdmin.from("lzt_config").select("max_fetch_price, currency, markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft").limit(1).maybeSingle(),
    ]);

    const tokenFromDb = lztTokenFromCredentialRows(lztCredsRes?.data);

    const token =
      tokenFromDb ||
      Deno.env.get("LZT_MARKET_TOKEN")?.trim() ||
      Deno.env.get("LZT_API_TOKEN")?.trim() ||
      "";

    if (!token) {
      console.error("LZT token missing: configure system_credentials or LZT_MARKET_TOKEN / LZT_API_TOKEN secret");
      return new Response(JSON.stringify({ error: "LZT token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rememberLztToken(token);
    console.log("Authentication and credentials loaded successfully");

    const itemId = url.searchParams.get("item_id");
    const gameType = url.searchParams.get("game_type") || "riot";
    const previewMode = url.searchParams.get("preview") === "1";
    const requestedLimit = Number(url.searchParams.get("limit") || (previewMode ? "6" : "0"));
    const responseLimit = Number.isFinite(requestedLimit)
      ? Math.max(0, Math.min(Math.trunc(requestedLimit), 24))
      : 0;

    const disabledLztGameTypes = new Set(["steam", "csgo", "cs2"]);
    if (disabledLztGameTypes.has(String(gameType).toLowerCase())) {
      return new Response(JSON.stringify({ error: "Contas Steam/CS2 não estão mais disponíveis." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      // DEBUG: Log the final API URL
      console.log(`[DEBUG] Requesting LZT API: ${buyUrl}`);

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

    /** Admin "Preço Máximo (LZT)": max **customer BRL** used to derive LZT `pmax` when the user did not set `pmax`. */
    const maxFetchRaw = Number(lztConfig?.max_fetch_price);
    const listFetchCapBrl =
      Number.isFinite(maxFetchRaw) && maxFetchRaw > 0 ? maxFetchRaw : 2500;

    // DETAIL: Get single item
    let apiUrl: string;
    if (action === "detail" && itemId) {
      apiUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}`;
    } else {
      // LIST: accounts with filters
      const params = new URLSearchParams();
      const allowedParams = [
        "page", "pmin", "pmax", "title", "order_by", "currency",
        "weapon_name",
        "nsb",  // not sold before
        "daybreak", // minimum days offline (inactivity)
        "rmin", "rmax", "last_rmin", "last_rmax", "previous_rmin", "previous_rmax",
        "valorant_level_min", "valorant_level_max",
        "valorant_smin", "valorant_smax",
        "valorant_knife_min", "valorant_knife_max",
        "vp_min", "vp_max", "rp_min", "rp_max",
        "fa_min", "fa_max",
        "inv_min", "inv_max",
        "knife",
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

      // Inatividade mínima via `daybreak` na API LZT (Fortnite: 90 dias; demais: 30).
      const minDays = gameType === "fortnite" ? FORTNITE_MIN_INACTIVE_DAYS : MIN_INACTIVE_DAYS;
      if (!params.get("daybreak") || Number(params.get("daybreak")) < minDays) {
        params.set("daybreak", String(minDays));
      }

      // Todas as categorias: apenas contas que nunca foram vendidas antes no LZT (`nsb`).
      params.set("nsb", "1");

      // Valorant: mínimo de skins na API LZT (`valorant_smin`; não confundir com LoL/FN que usam 10)
      if (gameType === "riot" || gameType === "valorant") {
        if (!params.get("valorant_smin") || Number(params.get("valorant_smin")) < 5) {
          params.set("valorant_smin", "5");
        }
      } else if (gameType === "lol") {
        if (!params.get("lol_smin") || Number(params.get("lol_smin")) < 10) {
          params.set("lol_smin", "10");
        }
      }

      // Also enforce minimum 10 skins for Fortnite
      if (gameType === "fortnite") {
        if (!params.get("smin") || Number(params.get("smin")) < 10) {
          params.set("smin", "10");
        }
      }

      const arrayParams = [
        "weaponSkin[]", "buddy[]", "agent[]", "valorant_region[]",
        "valorant_rank_type[]", "email_type[]", "country[]",
        "champion[]", "skin[]", "lol_rank[]", "lol_region[]",
        "not_country[]", "medal[]", "relevant_games[]",
      ];
      for (const p of arrayParams) {
        const vals = url.searchParams.getAll(p);
        for (const v of vals) {
          params.append(p, v);
        }
      }

      const effectiveCurrency = normalizeCurrency(params.get("currency") || lztConfig?.currency);
      if (params.get("currency") || lztConfig?.currency) {
        params.set("currency", effectiveCurrency);
      }

      // Convert user-facing BRL filters into the seller currency used by LZT.
      // The previous logic divided only by markup, which under-fetched valid accounts.
      const userPmin = params.get("pmin");
      if (userPmin) {
        const brlMin = Number(userPmin);
        if (brlMin > 0) {
          if (brlMin <= MIN_PRICE_BRL) {
            params.delete("pmin");
          } else {
            const sellerPmin = convertBrlToSellerPrice(brlMin, effectiveCurrency, activeMarkup);
            if (sellerPmin) params.set("pmin", String(Math.max(1, Math.floor(sellerPmin))));
          }
        } else {
          params.delete("pmin");
        }
      }

      const userPmax = params.get("pmax");
      if (userPmax) {
        const brlMax = Number(userPmax);
        if (brlMax > 0) {
          const sellerPmax = convertBrlToSellerPrice(brlMax, effectiveCurrency, activeMarkup);
          if (sellerPmax) params.set("pmax", String(Math.ceil(sellerPmax * 1.1)));
        } else {
          params.delete("pmax");
        }
      } else {
        const sellerCap = convertBrlToSellerPrice(listFetchCapBrl, effectiveCurrency, activeMarkup);
        if (sellerCap) params.set("pmax", String(Math.ceil(sellerCap * 1.1)));
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

    const shouldCache = action !== "detail" && action !== "fast-buy" && action !== "change-price" && action !== "image-proxy";
    const cacheKey = `${apiUrl}|m=${activeMarkup}|max=${listFetchCapBrl}`;
    // Align in-memory + CDN TTL with fresh responses (preview 60s, list 30s; detail bypasses this cache)
    const listCacheMaxAge = previewMode ? 60 : 30;
    const listMemoryTtlMs = previewMode ? 60_000 : 30_000;

    if (shouldCache) {
      const cached = globalLztCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        console.log("Serving from global cache:", apiUrl);
        const cachedData = cached.data as Record<string, unknown>;
        return new Response(JSON.stringify(cachedData), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${listCacheMaxAge}, s-maxage=${listCacheMaxAge}`,
          },
        });
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
      
      let detail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error_description) detail = errorJson.error_description;
        else if (errorJson.message) detail = errorJson.message;
      } catch (e) {
        // Not JSON
      }

      console.error("LZT API error after retries:", status, detail);
      return new Response(
        JSON.stringify({ error: "LZT API error", status, detail }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await parseJsonResponse(response);

    if (!data || typeof data !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid LZT response", detail: "Response body is not a JSON object" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalizar formato da resposta GET /{item_id} (às vezes `items[0]` ou objeto plano sem `item`)
    if (action === "detail" && itemId) {
      const d = data as Record<string, unknown>;
      if (!d.item) {
        if (Array.isArray(d.items) && d.items[0] && typeof d.items[0] === "object") {
          d.item = d.items[0];
        } else if (d.item_id != null && (typeof d.item_id === "string" || typeof d.item_id === "number")) {
          const flat: Record<string, unknown> = { ...d };
          delete flat.items;
          delete flat.item;
          d.item = flat;
        }
      }
    }

    if (action !== "detail") {
      if (!Array.isArray(data.items)) data.items = [];

      const currentPage = Math.max(1, Number(data.page || url.searchParams.get("page") || 1));
      const perPage = Math.max(1, Number(data.perPage || data.items.length || 1));
      const totalItems = Math.max(0, Number(data.totalItems || 0));
      const hasNextPageFromTotal = totalItems > currentPage * perPage;
      const hasNextPageFromPageFill = data.items.length >= perPage;

      data.page = currentPage;
      data.perPage = perPage;
      data.totalItems = totalItems;
      data.hasNextPage = hasNextPageFromTotal || (totalItems === 0 && hasNextPageFromPageFill);
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

      const beforeCount = data.items.length;
      let filteredByOther = 0;
      data.items = data.items.filter((item: LztItem) => {
        if (isLztItemStateSoldOrRemoved(item.item_state) || isLztItemStateAwaiting(item.item_state)) {
          filteredByOther++;
          return false;
        }
        if (hasLztItemBuyerAssigned(item)) { filteredByOther++; return false; }
        // More robust check for canBuyItem (catch false or null if it's supposed to be buyable)
        if (item.canBuyItem === false) { filteredByOther++; return false; }
        
        const displayedPriceBrl = getDisplayedPriceBrl(item, undefined, gameType, activeMarkup);
        
        if (!shouldKeepItem(item, gameType, displayedPriceBrl)) {
          filteredByOther++;
          return false;
        }
        return true;
      });

      if (responseLimit > 0 && data.items.length > responseLimit) {
        data.items = data.items.slice(0, responseLimit);
        data.perPage = Math.min(Number(data.perPage || responseLimit), responseLimit);
      }

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

      log("INFO", "lzt-market", "Filtered market items", {
        gameType,
        beforeCount,
        afterCount: data.items.length,
        filteredByOther,
      });

      // Normalize Fortnite field aliases so the client always sees `fortnite_skin_count`
      for (const item of data.items) {
        if (gameType === "fortnite" && item.fortnite_outfit_count != null && item.fortnite_skin_count == null) {
          item.fortnite_skin_count = item.fortnite_outfit_count;
        }
        item.price_brl = getDisplayedPriceBrl(item, overrideMap.get(String(item.item_id)), gameType, activeMarkup);

        // Strip heavy fields
        for (const field of STRIP_FIELDS) delete item[field];

        if (previewMode) {
          delete item.valorantInventory;

          if (item.imagePreviewLinks?.direct) {
            item.imagePreviewLinks = {
              direct: {
                weapons: item.imagePreviewLinks.direct.weapons,
                agents: item.imagePreviewLinks.direct.agents,
                buddies: item.imagePreviewLinks.direct.buddies,
              },
            };
          }

          continue;
        }

        // Trim valorantInventory to max 12 items per category (enough for preview)
        if (item.valorantInventory) {
          const inv = item.valorantInventory;
          const trimmed: Record<string, unknown> = {};
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

      // Re-sort by BRL price when user explicitly chose price sort.
      // The API sorts by native currency, but after markup/ceiling/floor the BRL
      // order can differ — causing cross-page inconsistencies.
      const orderBy = url.searchParams.get("order_by") || "";
      if (orderBy === "price_to_down") {
        data.items.sort((a: LztItem, b: LztItem) => (Number(b.price_brl) || 0) - (Number(a.price_brl) || 0));
      } else if (orderBy === "price_to_up") {
        data.items.sort((a: LztItem, b: LztItem) => (Number(a.price_brl) || 0) - (Number(b.price_brl) || 0));
      }
    }

    // For detail action, also add price_brl (keep full data)
    if (action === "detail" && data.item) {
      enrichDetailItemFromNestedInventory(data.item as LztItem, gameType);
      // SECURITY: vendido / removido / awaiting — não tratar `stickied`/`pre_active` como indisponível.
      const itemState = data.item.item_state;
      if (hasLztItemBuyerAssigned(data.item) || isLztItemStateSoldOrRemoved(itemState)) {
        return new Response(
          JSON.stringify({ error: "Account already sold", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (isLztItemStateAwaiting(itemState)) {
        return new Response(
          JSON.stringify({ error: "Account unavailable", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Não reprovar só por `canBuyItem: false` no GET do item — a listagem ainda mostra a conta;
      // checkout falha na LZT se realmente não for comprável.

      // Normalize Fortnite field aliases for detail too
      if (gameType === "fortnite" && data.item.fortnite_outfit_count != null && data.item.fortnite_skin_count == null) {
        data.item.fortnite_skin_count = data.item.fortnite_outfit_count;
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

      const passesStrict = shouldKeepItem(data.item, gameType, data.item.price_brl);
      const passesNoValue = passesStrict || shouldKeepItem(data.item, gameType, data.item.price_brl, {
        skipValueGate: true,
      });
      // Último nível: contadores por vezes ausentes no JSON do item — ainda bloqueia vendido/policy.
      const passesDetail = passesNoValue || shouldKeepItem(data.item, gameType, data.item.price_brl, {
        skipValueGate: true,
        skipMinSkins: true,
        skipCanBuyCheck: true,
      });
      if (!passesDetail) {
        return new Response(
          JSON.stringify({ error: "Account does not meet quality filters", item: null }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "detail" && !data.item) {
      return new Response(JSON.stringify({ error: "Account not found", item: null }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shorter cache: list 30s (60s preview), detail 10s
    const cacheMaxAge = action === "detail" ? 10 : listCacheMaxAge;

    if (shouldCache) {
      // Free up memory if cache gets too large (>200 items)
      if (globalLztCache.size > 200) {
        const oldestKey = globalLztCache.keys().next().value;
        if (oldestKey) globalLztCache.delete(oldestKey);
      }
      globalLztCache.set(cacheKey, { data, expiry: Date.now() + listMemoryTtlMs });
    }

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}`,
      },
    });
  } catch (error: unknown) {
    log("ERROR", "lzt-market", "Edge function error", {
      error: errorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
