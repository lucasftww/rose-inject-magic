import { supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";

/**
 * Meta Pixel + Conversions API (CAPI) — Enterprise-grade tracking
 * Pixel ID: 706054019233816
 *
 * Architecture:
 *   Browser → fbq events with Advanced Matching
 *   Server  → Edge Function server-relay with event_id deduplication
 *
 * Events (ativos): InitiateCheckout, Purchase — PageView/ViewContent não são enviados por pedido do negócio
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
 *   InitiateCheckout → random event_id (Pixel + CAPI via relay)
 *   Purchase → deterministic purchase_${transactionId} + sessionStorage guard (+ memória na mesma página)
 *
 * Test Events (Events Manager): definir META_TEST_EVENT_CODE em system_credentials ou secret da Edge
 * (server-relay + pix-payment). Remover em produção para contar só eventos reais.
 */


// ─── Constants ──────────────────────────────────────────────────────────────

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "706054019233816";
const STORAGE_KEY_EM = "_meta_em";
const STORAGE_KEY_EID = "_meta_eid";
const STORAGE_KEY_PH = "_meta_ph";
const STORAGE_KEY_FN = "_meta_fn";
const STORAGE_KEY_LN = "_meta_ln";

const devLog = (label: string, err?: unknown) => {
  if (import.meta.env.DEV) console.debug(`[metaPixel] ${label}`, err);
};

/** Headers exigidas pelo gateway Supabase + JSON para Edge Functions. */
const relayAuthHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
});

/** Reduz campos inválidos que costumam gerar 400 na Meta CAPI. */
const sanitizeRelayCustomData = (data: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (typeof data.content_name === "string") out.content_name = data.content_name.trim().slice(0, 500);
  if (Array.isArray(data.content_ids)) {
    out.content_ids = data.content_ids.map((id) => String(id)).filter(Boolean).slice(0, 100);
  }
  if (Array.isArray(data.contents)) {
    out.contents = data.contents
      .filter((c): c is { id?: unknown; quantity?: unknown } => c != null && typeof c === "object" && !Array.isArray(c))
      .map((c) => ({
        id: String(c.id ?? ""),
        quantity: Math.max(1, Math.min(1000, Math.floor(Number(c.quantity) || 1))),
      }))
      .filter((c) => c.id.length > 0)
      .slice(0, 100);
  }
  if (typeof data.content_type === "string") out.content_type = data.content_type.trim().slice(0, 50);
  if (data.value != null) {
    const v = Number(data.value);
    if (Number.isFinite(v) && v >= 0) out.value = Math.round(v * 100) / 100;
  }
  if (typeof data.currency === "string" && /^[A-Za-z]{3}$/.test(data.currency)) {
    out.currency = data.currency.toUpperCase();
  }
  if (typeof data.transaction_id === "string") out.transaction_id = data.transaction_id.trim().slice(0, 200);
  return out;
};

// ─── SHA-256 Hashing ────────────────────────────────────────────────────────

const sha256 = async (message: string): Promise<string> => {
  try {
    const msgBuffer = new TextEncoder().encode(message.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e: unknown) {
    devLog("sha256 failed", e);
    return "";
  }
};

// Pre-compute country hash (all users are BR)
let _countryHash = "";
sha256("br").then((h) => { _countryHash = h; });

// ─── Cached user identity ───────────────────────────────────────────────────

/** Evita Purchase duplicado no mesmo carregamento se sessionStorage falhar ou for lento. */
const _purchaseFiredThisDocument = new Set<string>();

let _cachedUserData: { em?: string; external_id?: string; ph?: string; fn?: string; ln?: string } = {};
let _pixelInitWithAM = false;
let _identityReadyPromise: Promise<void> | null = null;

const persistUserData = () => {
  try {
    if (_cachedUserData.em) localStorage.setItem(STORAGE_KEY_EM, _cachedUserData.em);
    if (_cachedUserData.external_id) localStorage.setItem(STORAGE_KEY_EID, _cachedUserData.external_id);
    if (_cachedUserData.ph) localStorage.setItem(STORAGE_KEY_PH, _cachedUserData.ph);
    if (_cachedUserData.fn) localStorage.setItem(STORAGE_KEY_FN, _cachedUserData.fn);
    if (_cachedUserData.ln) localStorage.setItem(STORAGE_KEY_LN, _cachedUserData.ln);
  } catch (e: unknown) {
    devLog("persistUserData failed", e);
  }
};

const restoreUserData = () => {
  try {
    const em = localStorage.getItem(STORAGE_KEY_EM);
    const eid = localStorage.getItem(STORAGE_KEY_EID);
    const ph = localStorage.getItem(STORAGE_KEY_PH);
    const fn = localStorage.getItem(STORAGE_KEY_FN);
    const ln = localStorage.getItem(STORAGE_KEY_LN);

    if (em) _cachedUserData.em = em;
    if (eid) _cachedUserData.external_id = eid;
    if (ph) _cachedUserData.ph = ph;
    if (fn) _cachedUserData.fn = fn;
    if (ln) _cachedUserData.ln = ln;
  } catch (e: unknown) {
    devLog("restoreUserData failed", e);
  }
};

// Initialize identity from storage immediately
restoreUserData();

/** Ensures that the identity (at least from storage) is ready */
const ensureIdentityReady = async () => {
  if (_identityReadyPromise) return _identityReadyPromise;
  
  _identityReadyPromise = (async () => {
    restoreUserData();
    await getHashedTrackingId(); // Pre-warm the tracking ID hash
  })();
  
  return _identityReadyPromise;
};

// ─── Advanced Matching ──────────────────────────────────────────────────────

export const setAdvancedMatching = async (userData: {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) => {
  const matchData: Record<string, string> = {};

  const promises: Promise<void>[] = [];

  if (userData.email) {
    promises.push(sha256(userData.email).then(hashed => {
      if (hashed) {
        matchData.em = hashed;
        _cachedUserData.em = hashed;
      }
    }));
  }
  if (userData.phone) {
    const cleaned = userData.phone.replace(/\D/g, "");
    promises.push(sha256(cleaned).then(hashed => {
      if (hashed) {
        matchData.ph = hashed;
        _cachedUserData.ph = hashed;
      }
    }));
  }
  if (userData.firstName) {
    promises.push(sha256(userData.firstName).then(hashed => {
      if (hashed) {
        matchData.fn = hashed;
        _cachedUserData.fn = hashed;
      }
    }));
  }
  if (userData.lastName) {
    promises.push(sha256(userData.lastName).then(hashed => {
      if (hashed) {
        matchData.ln = hashed;
        _cachedUserData.ln = hashed;
      }
    }));
  }
  if (userData.externalId) {
    promises.push(sha256(userData.externalId).then(hashed => {
      if (hashed) {
        matchData.external_id = hashed;
        _cachedUserData.external_id = hashed;
      }
    }));
  }

  await Promise.all(promises);

  // Always include country for Advanced Matching
  matchData.country = "br";

  persistUserData();

  if (typeof window !== "undefined" && window.fbq) {
    _pixelInitWithAM = true;
    window.fbq("init", PIXEL_ID, { ...matchData, external_id: matchData.external_id || undefined });
  }
};

/** Initialize the Pixel with cached data or default settings */
const initPixel = () => {
  if (typeof window === "undefined" || !window.fbq || _pixelInitWithAM) return;

  const matchData: Record<string, string> = {};
  if (_cachedUserData.em) matchData.em = _cachedUserData.em;
  if (_cachedUserData.ph) matchData.ph = _cachedUserData.ph;
  if (_cachedUserData.fn) matchData.fn = _cachedUserData.fn;
  if (_cachedUserData.ln) matchData.ln = _cachedUserData.ln;
  if (_cachedUserData.external_id) matchData.external_id = _cachedUserData.external_id;
  matchData.country = "br";

  _pixelInitWithAM = true;
  window.fbq("init", PIXEL_ID, Object.keys(matchData).length > 0 ? matchData : undefined);
};

// Eager initialization on module load
if (typeof window !== "undefined") {
  initPixel();
}

export const clearAdvancedMatching = () => {
  _cachedUserData = {};
  _pixelInitWithAM = false;
  try {
    localStorage.removeItem(STORAGE_KEY_EM);
    localStorage.removeItem(STORAGE_KEY_EID);
    localStorage.removeItem(STORAGE_KEY_PH);
    localStorage.removeItem(STORAGE_KEY_FN);
    localStorage.removeItem(STORAGE_KEY_LN);
  } catch (e: unknown) {
    devLog("clearAdvancedMatching storage failed", e);
  }
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
  } catch (e: unknown) {
    devLog("getOrCreateTrackingId failed", e);
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
  } catch (e: unknown) {
    devLog("setFbcCookie failed", e);
  }
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
      } catch (e: unknown) {
        devLog("fbclid storage write failed", e);
      }
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
  } catch (e: unknown) {
    devLog("getFbc read failed", e);
  }
  return "";
};

// ─── FBP with retry ─────────────────────────────────────────────────────────
// _fbp cookie may not be set immediately on first page load

const getFbp = (): string => {
  try {
    const fbpMatch = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/);
    return fbpMatch?.[1] || "";
  } catch (e: unknown) {
    devLog("getFbp failed", e);
    return "";
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateEventId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

interface TrackingData {
  contentName: string;
  contentIds: string[];
  /** Se omitido, cada `contentIds[i]` usa quantidade 1. */
  contents?: { id: string; quantity: number }[];
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

    // Hashed email + external_id + advanced
    if (!_cachedUserData.em && !_cachedUserData.external_id && !_cachedUserData.ph) restoreUserData();
    if (_cachedUserData.em) data.em = _cachedUserData.em;
    if (_cachedUserData.ph) data.ph = _cachedUserData.ph;
    if (_cachedUserData.fn) data.fn = _cachedUserData.fn;
    if (_cachedUserData.ln) data.ln = _cachedUserData.ln;

    // external_id: prefer authenticated user ID, fallback to first-party tracking ID
    if (_cachedUserData.external_id) {
      data.external_id = _cachedUserData.external_id;
    } else if (_trackingIdHash) {
      data.external_id = _trackingIdHash;
    }

    // event_source_url belongs on the event root in CAPI, not inside user_data (relay adds it from the body).

    // Country — always "br" (hashed for CAPI)
    if (_countryHash) data.country = _countryHash;
  } catch (e: unknown) {
    devLog("getUserData failed", e);
  }
  return data;
};

// Eagerly reconstruct fbc from storage on module load
getFbc();

/** Fire-and-forget server-side event via Edge Function */
const sendCAPI = async (
  eventName: string,
  eventId: string,
  customData: Record<string, unknown>
) => {
  try {
    if (!supabaseAnonKey.trim()) return;
    if (!eventName?.trim() || !eventId?.trim()) return;

    const url = `${new URL(supabaseUrl).origin}/functions/v1/server-relay`;

    // Wait for initial hashing to finish if it's the first event
    await ensureIdentityReady();

    // Collect user data, if fbp is missing schedule a retry
    const userData = getUserData();
    const eventTime = Math.floor(Date.now() / 1000);
    const sourceUrl =
      typeof window.location?.href === "string" && window.location.href.startsWith("http")
        ? window.location.href
        : "";

    const safeCustom = sanitizeRelayCustomData(customData);

    const body = JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_time: eventTime,
      ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
      action_source: "website",
      user_data: userData,
      custom_data: safeCustom,
    });

    void fetch(url, {
      method: "POST",
      headers: relayAuthHeaders(),
      body,
      keepalive: true,
      credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) devLog("CAPI relay HTTP error", r.status);
        else void r.json().then((j: unknown) => {
          if (j && typeof j === "object" && (j as { success?: boolean; relay?: string }).success === false) {
            devLog("CAPI relay response", j);
          }
        }).catch(() => {});
      })
      .catch((e: unknown) => devLog("CAPI relay fetch failed", e));

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
              ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
              action_source: "website",
              user_data: retryData,
              custom_data: safeCustom,
            });
            void fetch(url, {
              method: "POST",
              headers: relayAuthHeaders(),
              body: retryBody,
              keepalive: true,
              credentials: "omit",
            })
              .then((r) => {
                if (!r.ok) devLog("CAPI relay retry HTTP error", r.status);
                else void r.json().then((j: unknown) => {
                  if (j && typeof j === "object" && (j as { success?: boolean }).success === false) {
                    devLog("CAPI relay retry response", j);
                  }
                }).catch(() => {});
              })
              .catch((e: unknown) => devLog("CAPI relay retry failed", e));
          }
        }, delay);
      }
    }
  } catch (e: unknown) {
    devLog("sendCAPI failed", e);
  }
};

// ─── Event Tracking ─────────────────────────────────────────────────────────

export const trackInitiateCheckout = (data: TrackingData) => {
  if (typeof window === "undefined") return;

  const eventId = generateEventId("ic");
  const contents =
    data.contents?.length && data.contents.every((c) => c.id)
      ? data.contents
      : data.contentIds.map((id) => ({ id, quantity: 1 }));
  const customData: Record<string, unknown> = {
    content_name: data.contentName,
    content_ids: data.contentIds,
    contents,
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

  const tid = data.transactionId;
  if (!tid || tid === "unknown") {
    devLog("trackPurchase skipped: missing transactionId");
    return;
  }

  const eventId = `purchase_${tid}`;
  const storageKey = `_meta_purchase_${tid}`;

  if (_purchaseFiredThisDocument.has(tid)) return;
  try {
    if (sessionStorage.getItem(storageKey)) return;
  } catch (e: unknown) {
    devLog("trackPurchase sessionStorage read failed", e);
  }
  _purchaseFiredThisDocument.add(tid);
  try {
    sessionStorage.setItem(storageKey, eventId);
  } catch (e: unknown) {
    devLog("trackPurchase sessionStorage write failed", e);
  }

  const contents =
    data.contents?.length && data.contents.every((c) => c.id)
      ? data.contents
      : data.contentIds.map((id) => ({ id, quantity: 1 }));
  const customData: Record<string, unknown> = {
    content_name: data.contentName,
    content_ids: data.contentIds,
    contents,
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



