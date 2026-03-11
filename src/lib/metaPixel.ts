/**
 * Meta Pixel tracking utilities
 * Pixel ID: 4378225905838577
 * Supports: ViewContent, InitiateCheckout, Purchase
 * CAPI-ready with event_id deduplication
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

/**
 * Track ViewContent — fires when user views a product page
 */
export const trackViewContent = (data: TrackingData) => {
  if (typeof window === "undefined" || !window.fbq) return;

  const eventId = generateEventId("view");

  window.fbq("track", "ViewContent", {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
    event_id: eventId,
  });

  return eventId;
};

/**
 * Track InitiateCheckout — fires when user clicks "Buy Now"
 */
export const trackInitiateCheckout = (data: TrackingData) => {
  if (typeof window === "undefined" || !window.fbq) return;

  const eventId = generateEventId("checkout");

  window.fbq("track", "InitiateCheckout", {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
    event_id: eventId,
  });

  return eventId;
};

/**
 * Track Purchase — fires on payment confirmation
 */
export const trackPurchase = (data: TrackingData & { transactionId: string }) => {
  if (typeof window === "undefined" || !window.fbq) return;

  const eventId = `purchase_${data.transactionId}`;

  window.fbq("track", "Purchase", {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
    transaction_id: data.transactionId,
    event_id: eventId,
  });

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
