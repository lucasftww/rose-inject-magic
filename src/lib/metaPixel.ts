/**
 * Meta Pixel + Conversions API (CAPI) — Enterprise-grade tracking
 * Pixel ID: 4378225905838577
 *
 * Architecture:
 *   Browser → fbq events with Advanced Matching
 *   Server  → Edge Function meta-capi with event_id deduplication
 *
 * Events: PageView (auto), ViewContent, InitiateCheckout, Purchase
 * Categories: Valorant, Fortnite, Roblox, Minecraft, LoL, CS2, GTA
 *
 * user_data sent to CAPI:
 *   fbp, fbc              — from cookies / reconstructed from fbclid
 *   client_user_agent      — from browser (server fallback)
 *   client_ip_address      — server-side only (x-forwarded-for)
 *   em                     — SHA-256 hashed email
 *   external_id            — SHA-256 hashed user ID (or hashed first-party tracking ID for anonymous)
 *   country                — "br" (hashed) for all users
 *
 * Deduplication:
 *   ViewContent/InitiateCheckout → random event_id shared by Pixel+CAPI
 *   Purchase → deterministic purchase_${transactionId} + sessionStorage guard
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PIXEL_ID = "4378225905838577";
const STORAGE_KEY_EM = "_meta_em";
const STORAGE_KEY_EID = "_meta_eid";

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

// Pre-compute country hash (all users are BR)
let _countryHash = "";
sha256("br").then((h) => { _countryHash = h; });

// ─── Cached user identity ───────────────────────────────────────────────────

let _cachedUserData: { em?: string; external_id?: string } = {};
let _pixelInitWithAM = false;

const persistUserData = () => {
  try {
    if (_cachedUserData.em) localStorage.setItem(STORAGE_KEY_EM, _cachedUserData.em);
    if (_cachedUserData.external_id) localStorage.setItem(STORAGE_KEY_EID, _cachedUserData.external_id);
  } catch (_) { /* ignore */ }
};

const restoreUserData = () => {
  try {
    const em = localStorage.getItem(STORAGE_KEY_EM);
    const eid = localStorage.getItem(STORAGE_KEY_EID);
    if (em) _cachedUserData.em = em;
    if (eid) _cachedUserData.external_id = eid;
  } catch (_) { /* ignore */ }
};

restoreUserData();

// ─── Advanced Matching ──────────────────────────────────────────────────────

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
    const hashed = await sha256(userData.externalId);
    if (hashed) {
      // Use hashed value for both fbq and CAPI — Meta requires hashed external_id
      matchData.external_id = hashed;
      _cachedUserData.external_id = hashed;
    }
  }

  // Always include country for Advanced Matching
  matchData.country = "br";

  persistUserData();

  if (typeof window !== "undefined" && window.fbq && Object.keys(matchData).length > 0 && !_pixelInitWithAM) {
    _pixelInitWithAM = true;
    window.fbq("init", PIXEL_ID, matchData);
  }
};

export const clearAdvancedMatching = () => {
  _cachedUserData = {};
  _pixelInitWithAM = false;
  try {
    localStorage.removeItem(STORAGE_KEY_EM);
    localStorage.removeItem(STORAGE_KEY_EID);
  } catch (_) { /* ignore */ }
};

// ─── First-Party Tracking ID ────────────────────────────────────────────────

const TRACKING_ID_KEY = "_store_trk_id";
const TRACKING_COOKIE_DAYS = 365;

let _trackingIdHash: string | null = null;

const getOrCreateTrackingId = (): string => {
  try {
    let id = localStorage.getItem(TRACKING_ID_KEY);
    if (id) return id;

    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TRACKING_ID_KEY}=([^;]*)`));
    if (match) {
      id = match[1];
      localStorage.setItem(TRACKING_ID_KEY, id);
      return id;
    }

    id = `trk_${Date.now()}_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(TRACKING_ID_KEY, id);
    const expires = new Date(Date.now() + TRACKING_COOKIE_DAYS * 86400000).toUTCString();
    document.cookie = `${TRACKING_ID_KEY}=${id}; path=/; expires=${expires}; SameSite=Lax; Secure`;
    return id;
  } catch {
    return "";
  }
};

const getHashedTrackingId = async (): Promise<string> => {
  if (_trackingIdHash) return _trackingIdHash;
  const id = getOrCreateTrackingId();
  if (id) {
    _trackingIdHash = await sha256(id);
  }
  return _trackingIdHash || "";
};

// Eagerly initialize tracking ID and hash it
getHashedTrackingId();

// ─── FBC Reconstruction ────────────────────────────────────────────────────
// Aggressively reconstruct _fbc from all possible fbclid sources and persist as cookie

const setFbcCookie = (fbc: string) => {
  try {
    const expires = new Date(Date.now() + 90 * 86400000).toUTCString();
    document.cookie = `_fbc=${fbc}; path=/; expires=${expires}; SameSite=Lax; Secure`;
  } catch { /* cookie write failed */ }
};

const getFbc = (): string => {
  try {
    // 1. Check _fbc cookie first
    const fbcMatch = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/);
    if (fbcMatch?.[1]) return fbcMatch[1];

    // 2. Check URL params (current page)
    const urlParams = new URLSearchParams(window.location.search);
    const fbclidFromUrl = urlParams.get("fbclid");
    if (fbclidFromUrl) {
      const fbc = `fb.1.${Date.now()}.${fbclidFromUrl}`;
      try {
        localStorage.setItem("fbclid", fbclidFromUrl);
        sessionStorage.setItem("_ck_fbclid", fbclidFromUrl);
      } catch (_) {}
      // Persist as cookie so Meta Pixel can read it
      setFbcCookie(fbc);
      return fbc;
    }

    // 3. Check localStorage/sessionStorage (persisted from landing)
    const fbclid =
      localStorage.getItem("fbclid") ||
      sessionStorage.getItem("_ck_fbclid");
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      // Set cookie so subsequent events have it
      setFbcCookie(fbc);
      return fbc;
    }
  } catch (_) {}
  return "";
};

// ─── FBP with retry ─────────────────────────────────────────────────────────
// _fbp cookie may not be set immediately on first page load

const getFbp = (): string => {
  try {
    const fbpMatch = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/);
    return fbpMatch?.[1] || "";
  } catch (_) {
    return "";
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
export const getUserData = (): Record<string, string> => {
  const data: Record<string, string> = {};
  try {
    // _fbp
    const fbp = getFbp();
    if (fbp) data.fbp = fbp;

    // _fbc (aggressive reconstruction)
    const fbc = getFbc();
    if (fbc) data.fbc = fbc;

    // User agent
    data.client_user_agent = navigator.userAgent;

    // Hashed email + external_id
    if (!_cachedUserData.em && !_cachedUserData.external_id) restoreUserData();
    if (_cachedUserData.em) data.em = _cachedUserData.em;

    // external_id: prefer authenticated user ID, fallback to first-party tracking ID
    if (_cachedUserData.external_id) {
      data.external_id = _cachedUserData.external_id;
    } else if (_trackingIdHash) {
      data.external_id = _trackingIdHash;
    }

    // Country — always "br" (hashed for CAPI)
    if (_countryHash) data.country = _countryHash;
  } catch (_) { /* ignore */ }
  return data;
};

// Eagerly reconstruct fbc from storage on module load
getFbc();

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

    // Collect user data, if fbp is missing schedule a retry
    let userData = getUserData();
    const eventTime = Math.floor(Date.now() / 1000);
    const sourceUrl = window.location.href;

    const body = JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_time: eventTime,
      event_source_url: sourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: customData,
    });

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => { /* ignore */ });

    // If fbp or fbc was missing, retry at 1s and 3s (Meta Pixel may need time to set cookies)
    if (!userData.fbp || !userData.fbc) {
      const retryDelays = [1000, 3000];
      for (const delay of retryDelays) {
        setTimeout(() => {
          const retryData = getUserData();
          // Only retry if we gained new data
          if ((!userData.fbp && retryData.fbp) || (!userData.fbc && retryData.fbc)) {
            const retryBody = JSON.stringify({
              event_name: eventName,
              event_id: eventId, // same event_id = Meta deduplicates
              event_time: eventTime, // use original event_time to ensure proper deduplication
              event_source_url: sourceUrl,
              action_source: "website",
              user_data: retryData,
              custom_data: customData,
            });
            fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
              },
              body: retryBody,
              keepalive: true,
              credentials: "omit",
            }).catch(() => {});
          }
        }, delay);
      }
    }
  } catch (_) { /* ignore */ }
};

// ─── Event Tracking ─────────────────────────────────────────────────────────

export const trackViewContent = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("vc");
  const customData: Record<string, any> = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    contents: data.contentIds.map((id) => ({ id, quantity: 1 })),
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
  };

  if (window.fbq) {
    window.fbq("track", "ViewContent", customData, { eventID: eventId });
  }
  sendCAPI("ViewContent", eventId, customData);

  return eventId;
};

export const trackInitiateCheckout = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("ic");
  const customData: Record<string, any> = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    contents: data.contentIds.map((id) => ({ id, quantity: 1 })),
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
  };

  if (window.fbq) {
    window.fbq("track", "InitiateCheckout", customData, { eventID: eventId });
  }
  sendCAPI("InitiateCheckout", eventId, customData);

  return eventId;
};

export const trackPurchase = (
  data: TrackingData & { transactionId: string }
) => {
  if (typeof window === "undefined") return;

  const eventId = `purchase_${data.transactionId}`;

  const storageKey = `_meta_purchase_${data.transactionId}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, eventId);
  } catch (_) { /* ignore */ }

  const customData: Record<string, any> = {
    content_name: data.contentName,
    content_category: data.contentCategory,
    content_ids: data.contentIds,
    contents: data.contentIds.map((id) => ({ id, quantity: 1 })),
    content_type: "product",
    value: data.value,
    currency: data.currency || "BRL",
    transaction_id: data.transactionId,
  };

  if (window.fbq) {
    window.fbq("track", "Purchase", customData, { eventID: eventId });
  }
  sendCAPI("Purchase", eventId, customData);

  return eventId;
};

// ─── Category Resolution ────────────────────────────────────────────────────

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