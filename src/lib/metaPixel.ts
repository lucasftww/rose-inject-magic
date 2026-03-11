/**
 * Meta Pixel + Conversions API (CAPI) tracking
 * Pixel ID: 4378225905838577
 * 
 * Browser: fbq events with Advanced Matching
 * Server: Edge Function meta-capi with event_id deduplication
 * 
 * Events: ViewContent, InitiateCheckout, Purchase
 * Categories: Valorant, Fortnite, Roblox, Minecraft, LoL, CS2, GTA
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

// ─── Advanced Matching ──────────────────────────────────────────────────────

/**
 * Update pixel with Advanced Matching data when user logs in.
 * Call this after authentication to improve Event Match Quality.
 */
export const setAdvancedMatching = async (userData: {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
}) => {
  if (typeof window === "undefined" || !window.fbq) return;

  const matchData: Record<string, string> = {};

  if (userData.email) {
    matchData.em = await sha256(userData.email);
  }
  if (userData.phone) {
    // Remove non-digits, ensure country code
    const cleaned = userData.phone.replace(/\D/g, "");
    matchData.ph = await sha256(cleaned);
  }
  if (userData.externalId) {
    matchData.external_id = userData.externalId;
  }

  if (Object.keys(matchData).length > 0) {
    window.fbq("init", "4378225905838577", matchData);
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateEventId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

interface TrackingData {
  contentName: string;
  contentCategory: string;
  contentIds: string[];
  value: number;
  currency?: string;
  transactionId?: string;
}

/** Collect user_data for CAPI from cookies/storage */
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

    // Client IP hint (if available)
    // Note: actual IP is resolved server-side
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

  // Browser Pixel
  if (window.fbq) {
    window.fbq("track", "ViewContent", { ...customData, event_id: eventId });
  }
  // Server CAPI
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
 * Track Purchase — fires ONLY on confirmed payment
 * Never on page load, only after payment status = COMPLETED
 */
export const trackPurchase = (
  data: TrackingData & { transactionId: string }
) => {
  if (typeof window === "undefined") return;

  // Deterministic event_id based on transaction for deduplication
  const eventId = `purchase_${data.transactionId}`;
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
 * Used for content_category in all events — enables remarketing by game.
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
