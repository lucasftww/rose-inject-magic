/**
 * Meta Pixel + Conversions API (CAPI) tracking
 * Pixel ID: 4378225905838577
 * Browser-side: fbq events
 * Server-side: Edge Function meta-capi with event_id deduplication
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

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
    // fbp cookie
    const fbpMatch = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/);
    if (fbpMatch) data.fbp = fbpMatch[1];
    // fbc from cookie or sessionStorage
    const fbcMatch = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/);
    if (fbcMatch) {
      data.fbc = fbcMatch[1];
    } else {
      const fbclid = sessionStorage.getItem("_ck_fbclid");
      if (fbclid) data.fbc = `fb.1.${Date.now()}.${fbclid}`;
    }
    // client_user_agent
    data.client_user_agent = navigator.userAgent;
  } catch (_) {}
  return data;
};

/** Fire-and-forget server-side event via Edge Function */
const sendCAPI = (eventName: string, eventId: string, customData: Record<string, any>) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    const url = `https://${projectId}.supabase.co/functions/v1/meta-capi`;
    const body = JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      user_data: getUserData(),
      custom_data: customData,
    });
    // Use sendBeacon for reliability, fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch (_) {}
};

/**
 * Track ViewContent — fires when user views a product page
 */
export const trackViewContent = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("view");
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

  const eventId = generateEventId("checkout");
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
 * Track Purchase — fires on payment confirmation
 */
export const trackPurchase = (data: TrackingData & { transactionId: string }) => {
  if (typeof window === "undefined") return;

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

/**
 * Resolve game category from game name or slug
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
