/**
 * Meta Pixel + Conversions API (CAPI) tracking
 * Pixel ID: 4378225905838577
 *
 * Browser: fbq events with Advanced Matching
 * Server: Edge Function meta-capi with event_id deduplication
 *
 * Events: ViewContent, InitiateCheckout, Purchase
 * Categories: Valorant, Fortnite, Roblox, Minecraft, LoL, CS2, GTA
 *
 * user_data sent to CAPI:
 *   fbp, fbc, client_user_agent (browser)
 *   client_ip_address (server-side)
 *   em (SHA-256 hashed email)
 *   external_id (Supabase user id)
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

// ─── SHA-256 Hashing ────────────────────────────────────────────────────────

const sha256 = async (message: string): Promise<string> => {
  try {
    const msgBuffer = new TextEncoder().encode(message.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
};

// ─── Cached user identity for CAPI ─────────────────────────────────────────

let _cachedUserData: { em?: string; external_id?: string } = {};

/**
 * Update pixel with Advanced Matching data when user logs in.
 * Also caches hashed email + external_id for CAPI calls.
 */
export const setAdvancedMatching = async (userData: {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
}) => {
  const matchData: Record<string, string> = {};

  if (userData.email) {
    const hashed = await sha256(userData.email);
    if (hashed) {
      matchData.em = hashed;
      _cachedUserData.em = hashed;
    }
  }
  if (userData.phone) {
    const cleaned = userData.phone.replace(/\D/g, "");
    const hashed = await sha256(cleaned);
    if (hashed) matchData.ph = hashed;
  }
  if (userData.externalId) {
    matchData.external_id = userData.externalId;
    _cachedUserData.external_id = userData.externalId;
  }

  if (typeof window !== "undefined" && window.fbq && Object.keys(matchData).length > 0) {
    window.fbq("init", "4378225905838577", matchData);
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateEventId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export interface TrackingData {
  contentName: string;
  contentCategory: string;
  contentIds: string[];
  value: number;
  currency?: string;
  transactionId?: string;
}

/** Collect user_data for CAPI from cookies/storage + cached identity */
const getUserData = (): Record<string, string> => {
  const data: Record<string, string> = {};
  try {
    // _fbp cookie (set by Meta Pixel)
    const fbpMatch = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/);
    if (fbpMatch) data.fbp = fbpMatch[1];

    // _fbc cookie or reconstruct from stored fbclid
    const fbcMatch = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/);
    if (fbcMatch) {
      data.fbc = fbcMatch[1];
    } else {
      const fbclid =
        localStorage.getItem("fbclid") ||
        sessionStorage.getItem("_ck_fbclid");
      if (fbclid) data.fbc = `fb.1.${Date.now()}.${fbclid}`;
    }

    // User agent
    data.client_user_agent = navigator.userAgent;

    // Cached hashed email + external_id from Advanced Matching
    if (_cachedUserData.em) data.em = _cachedUserData.em;
    if (_cachedUserData.external_id) data.external_id = _cachedUserData.external_id;
  } catch (_) {}
  return data;
};

/** Fire-and-forget server-side event via Edge Function */
const sendCAPI = (
  eventName: string,
  eventId: string,
  customData: Record<string, any>
) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;

    const url = `https://${projectId}.supabase.co/functions/v1/meta-capi`;
    const body = JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      action_source: "website",
      user_data: getUserData(),
      custom_data: customData,
    });

    // sendBeacon for reliability (survives page unload), fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch (_) {}
};

// ─── Event Tracking ─────────────────────────────────────────────────────────

/**
 * Track ViewContent — fires when user views a product page
 */
export const trackViewContent = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("vc");
  const customData = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
  };

  if (window.fbq) {
    window.fbq("track", "ViewContent", { ...customData, event_id: eventId });
  }
  sendCAPI("ViewContent", eventId, customData);

  return eventId;
};

/**
 * Track InitiateCheckout — fires when user clicks "Buy Now"
 */
export const trackInitiateCheckout = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("ic");
  const customData = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
  };

  if (window.fbq) {
    window.fbq("track", "InitiateCheckout", { ...customData, event_id: eventId });
  }
  sendCAPI("InitiateCheckout", eventId, customData);

  return eventId;
};

/**
 * Track Purchase — fires ONLY on confirmed payment (COMPLETED status)
 * Never on page load. Deterministic event_id for deduplication.
 */
export const trackPurchase = (
  data: TrackingData & { transactionId: string }
) => {
  if (typeof window === "undefined") return;

  // Deterministic event_id: same transactionId = same event_id = Meta deduplicates
  const eventId = `purchase_${data.transactionId}`;

  // Guard against double-firing (e.g. polling returns COMPLETED twice)
  const storageKey = `_meta_purchase_${data.transactionId}`;
  try {
    if (sessionStorage.getItem(storageKey)) return eventId;
    sessionStorage.setItem(storageKey, "1");
  } catch (_) {}

  const customData = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
    transaction_id: data.transactionId,
  };

  if (window.fbq) {
    window.fbq("track", "Purchase", { ...customData, event_id: eventId });
  }
  sendCAPI("Purchase", eventId, customData);

  return eventId;
};

// ─── Category Resolution ────────────────────────────────────────────────────

/**
 * Resolve game category from game name or slug.
 * Used for content_category — enables remarketing audiences by game.
 */
export const resolveCategory = (gameName?: string | null): string => {
  if (!gameName) return "Outros";
  const lower = gameName.toLowerCase();
  if (lower.includes("valorant")) return "Valorant";
  if (lower.includes("fortnite")) return "Fortnite";
  if (lower.includes("roblox")) return "Roblox";
  if (lower.includes("minecraft")) return "Minecraft";
  if (lower.includes("lol") || lower.includes("league")) return "League of Legends";
  if (lower.includes("cs") || lower.includes("counter")) return "CS2";
  if (lower.includes("gta")) return "GTA";
  return gameName;
};
