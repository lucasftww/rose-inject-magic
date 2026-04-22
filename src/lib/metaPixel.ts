import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";

/**
 * Meta Pixel (browser) + Conversions API (CAPI) — mapa para configurar o Events Manager / Ads sem surpresas.
 *
 * ─── Matriz: o que o código envia ───────────────────────────────────────────
 * | Onde no site           | fbq (Pixel)                    | CAPI browser (server-relay)     | CAPI servidor (pix-payment)   |
 * |------------------------|--------------------------------|----------------------------------|-------------------------------|
 * | Qualquer rota (1ª carga)| PageView (index.html)        | —                                | —                             |
 * | Navegação SPA          | PageView (`trackSpaPageView`) | —                                | —                             |
 * | `/contas` (mount)      | trackCustom `IC_SECTION_CONTAS` + params `section`,`content_name` | — (relay só IC/Purchase standard) | — |
 * | `/contas` (troca tab)  | trackCustom `IC_CATEGORY_*` + `content_category` = slug jogo   | —                                | —                             |
 * | `/checkout`            | InitiateCheckout + `section`,`content_category`, value…          | Igual + mesmo `event_id`         | —                             |
 * | `/pedido/sucesso`      | Purchase + dedupe `purchase_${paymentId}`                      | Igual                             | Purchase (pagamento pago)     |
 *
 * Regras na Meta (Conversões personalizadas):
 * - “IC / Purchase — Contas — Fortnite”: use evento **standard** `InitiateCheckout` ou `Purchase` com filtros em
 *   `custom_data.section === "contas"` e `custom_data.content_category === "fortnite"` (slug canónico).
 * - Listagem `/contas`: use **nome do evento personalizado** exatamente `IC_SECTION_CONTAS` ou `IC_CATEGORY_FORTNITE`, etc.
 *
 * Categorias (`content_category`): slugs `valorant` | `lol` | `fortnite` | `minecraft` | `multi` | `produto` — ver
 * `buildMetaPurchasePayload.ts`, snapshot de carrinho e `pix-payment` (validação LZT infere jogo pela API se faltar).
 *
 * Pontos de atenção (produto Meta, não bug da app):
 * - **Ads Manager “Resultados” (—)** pode ser coluna a otimizar outra métrica / janela de atribuição ≠ detalhe do evento no Events Manager.
 * - **CAPI browser** precisa de **sessão Supabase** (JWT); `relayAuthHeadersWithRetry` reduz perdas se o token hidratar tarde.
 * - **`npm run dev`**: Pixel no HTML desligado por defeito — `VITE_ENABLE_META_PIXEL_DEV=true` no `.env` ou `vite preview` após build.
 * - **Deploy Edge**: alterações em `supabase/functions/pix-payment` exigem deploy da função para CAPI servidor atualizar.
 *
 * Deduplicação: IC usa `event_id` aleatório partilhado Pixel+CAPI relay + fingerprint local (janela curta);
 * Purchase usa `purchase_${transactionId}` Pixel+CAPI relay+Graph no pagamento.
 */


// ─── Constants ──────────────────────────────────────────────────────────────

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "706054019233816";
const STORAGE_KEY_EM = "_meta_em";
const STORAGE_KEY_EID = "_meta_eid";
const STORAGE_KEY_PH = "_meta_ph";
const STORAGE_KEY_FN = "_meta_fn";
const STORAGE_KEY_LN = "_meta_ln";
const STORAGE_KEY_GE = "_meta_ge";
const STORAGE_KEY_DB = "_meta_db";
const STORAGE_KEY_CT = "_meta_ct";
const STORAGE_KEY_ST = "_meta_st";
const STORAGE_KEY_ZP = "_meta_zp";
const STORAGE_KEY_SID = "_meta_sid";

const devLog = (label: string, err?: unknown) => {
  if (import.meta.env.DEV) console.debug(`[metaPixel] ${label}`, err);
};

/** Evita PageView automático da Meta em cada navegação client-side (SPA). Ver blog Meta Pixel + SPAs. */
function disableSpaAutoPageView(): void {
  try {
    if (typeof window === "undefined" || !window.fbq) return;
    window.fbq.disablePushState = true;
  } catch (e: unknown) {
    devLog("disableSpaAutoPageView failed", e);
  }
}

/**
 * PageView em navegação client-side (React Router).
 * O primeiro PageView do visitante vem do `index.html` após init; não duplicar no primeiro paint da SPA.
 */
export function trackSpaPageView(): void {
  if (typeof window === "undefined") return;
  runWhenFbqReady(() => {
    if (!window.fbq) return;
    try {
      window.fbq("track", "PageView");
    } catch (e: unknown) {
      devLog("trackSpaPageView failed", e);
    }
  });
}

/**
 * O `fbq` só existe depois do `load` + idle no `index.html` — a rota `/contas` monta antes e perdia `trackCustom`.
 * Enfileira e dispara quando o Pixel estiver pronto (ou abandona após timeout).
 */
const FBQ_READY_POLL_MS = 80;
const FBQ_READY_MAX_POLLS = 100;
let fbqReadyPollId: ReturnType<typeof setInterval> | null = null;
const fbqReadyQueue: Array<() => void> = [];

function flushFbqReadyQueue(): void {
  while (fbqReadyQueue.length > 0) {
    const fn = fbqReadyQueue.shift();
    try {
      fn?.();
    } catch (e: unknown) {
      devLog("fbq ready queue runner failed", e);
    }
  }
}

function runWhenFbqReady(fn: () => void): void {
  if (typeof window === "undefined") return;
  if (window.fbq) {
    fn();
    return;
  }
  fbqReadyQueue.push(fn);
  if (fbqReadyPollId != null) return;
  let polls = 0;
  fbqReadyPollId = window.setInterval(() => {
    polls += 1;
    if (window.fbq) {
      window.clearInterval(fbqReadyPollId!);
      fbqReadyPollId = null;
      flushFbqReadyQueue();
      return;
    }
    if (polls >= FBQ_READY_MAX_POLLS) {
      window.clearInterval(fbqReadyPollId!);
      fbqReadyPollId = null;
      fbqReadyQueue.length = 0;
      devLog("runWhenFbqReady: fbq never became available (pixel blocked or slow load)");
    }
  }, FBQ_READY_POLL_MS);
}

/** Abas de jogo na página Contas — nomes alinhados ao Pixel (Events Manager → Eventos personalizados). */
type ContasGameTabForPixel =
  | "valorant"
  | "lol"
  | "fortnite"
  | "minecraft"
  | "genshin"
  | "honkai"
  | "zzz"
  | "brawlstars";

const IC_CATEGORY_EVENT_BY_TAB: Record<ContasGameTabForPixel, string> = {
  valorant: "IC_CATEGORY_VALORANT",
  lol: "IC_CATEGORY_LOL",
  fortnite: "IC_CATEGORY_FORTNITE",
  minecraft: "IC_CATEGORY_MINECRAFT",
  genshin: "IC_CATEGORY_GENSHIN",
  honkai: "IC_CATEGORY_HONKAI",
  zzz: "IC_CATEGORY_ZZZ",
  brawlstars: "IC_CATEGORY_BRAWL_STARS",
};

/** Uma vez por visita à secção Contas — alimenta conversões/regras que usam `IC_SECTION_CONTAS`. */
export function trackContasSectionCustomEvent(): void {
  runWhenFbqReady(() => {
    if (!window.fbq) return;
    try {
      window.fbq("trackCustom", "IC_SECTION_CONTAS", {
        section: "contas",
        content_name: "Contas",
      });
    } catch (e: unknown) {
      devLog("trackContasSectionCustomEvent failed", e);
    }
  });
}

/** Troca de aba Valorant / LoL / Fortnite / Minecraft — alimenta `IC_CATEGORY_FORTNITE`, etc. */
export function trackContasCategoryCustomEvent(tab: ContasGameTabForPixel): void {
  const eventName = IC_CATEGORY_EVENT_BY_TAB[tab];
  if (!eventName) return;
  runWhenFbqReady(() => {
    if (!window.fbq) return;
    try {
      window.fbq("trackCustom", eventName, {
        section: "contas",
        content_category: tab,
        content_name:
          tab === "valorant"
            ? "Contas Valorant"
            : tab === "lol"
              ? "Contas LoL"
              : tab === "fortnite"
                ? "Contas Fortnite"
                : tab === "minecraft"
                  ? "Contas Minecraft"
                  : tab === "genshin"
                    ? "Contas Genshin"
                    : tab === "honkai"
                      ? "Contas Honkai"
                      : tab === "zzz"
                        ? "Contas Zenless"
                        : "Contas Brawl Stars",
      });
    } catch (e: unknown) {
      devLog("trackContasCategoryCustomEvent failed", e);
    }
  });
}

/** Headers do relay: JWT real do utilizador + apikey do projeto. */
const relayAuthHeaders = async (): Promise<Record<string, string> | null> => {
  try {
    let {
      data: { session },
    } = await supabase.auth.getSession();
    let token = String(session?.access_token || "").trim();
    const expMs = session?.expires_at ? session.expires_at * 1000 : 0;
    if (token && expMs > 0 && expMs < Date.now() + 120_000) {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.access_token) {
        session = data.session;
        token = String(data.session.access_token).trim();
      }
    }
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    };
  } catch (e: unknown) {
    devLog("relayAuthHeaders failed", e);
    return null;
  }
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** JWT por vezes hidrata logo após o primeiro paint do `/checkout` — evita CAPI InitiateCheckout/Purchase perdidos. */
const RELAY_AUTH_RETRY_DELAYS_MS = [0, 120, 260, 500];

async function relayAuthHeadersWithRetry(): Promise<Record<string, string> | null> {
  for (const delayMs of RELAY_AUTH_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    const h = await relayAuthHeaders();
    if (h) return h;
  }
  return null;
}

/** Reduz campos inválidos que costumam gerar 400 na Meta CAPI. */
const sanitizeRelayCustomData = (data: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (typeof data.content_name === "string") out.content_name = data.content_name.trim().slice(0, 500);
  if (typeof data.content_category === "string") out.content_category = data.content_category.trim().slice(0, 200);
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
  if (typeof data.section === "string") out.section = data.section.trim().slice(0, 50);
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

let _cachedUserData: {
  em?: string;
  external_id?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ge?: string;
  db?: string;
  ct?: string;
  st?: string;
  zp?: string;
  subscription_id?: string;
} = {};
let _pixelInitWithAM = false;
let _identityReadyPromise: Promise<void> | null = null;

const persistUserData = () => {
  try {
    if (_cachedUserData.em) localStorage.setItem(STORAGE_KEY_EM, _cachedUserData.em);
    if (_cachedUserData.external_id) localStorage.setItem(STORAGE_KEY_EID, _cachedUserData.external_id);
    if (_cachedUserData.ph) localStorage.setItem(STORAGE_KEY_PH, _cachedUserData.ph);
    if (_cachedUserData.fn) localStorage.setItem(STORAGE_KEY_FN, _cachedUserData.fn);
    if (_cachedUserData.ln) localStorage.setItem(STORAGE_KEY_LN, _cachedUserData.ln);
    if (_cachedUserData.ge) localStorage.setItem(STORAGE_KEY_GE, _cachedUserData.ge);
    if (_cachedUserData.db) localStorage.setItem(STORAGE_KEY_DB, _cachedUserData.db);
    if (_cachedUserData.ct) localStorage.setItem(STORAGE_KEY_CT, _cachedUserData.ct);
    if (_cachedUserData.st) localStorage.setItem(STORAGE_KEY_ST, _cachedUserData.st);
    if (_cachedUserData.zp) localStorage.setItem(STORAGE_KEY_ZP, _cachedUserData.zp);
    if (_cachedUserData.subscription_id) localStorage.setItem(STORAGE_KEY_SID, _cachedUserData.subscription_id);
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
    const ge = localStorage.getItem(STORAGE_KEY_GE);
    const db = localStorage.getItem(STORAGE_KEY_DB);
    const ct = localStorage.getItem(STORAGE_KEY_CT);
    const st = localStorage.getItem(STORAGE_KEY_ST);
    const zp = localStorage.getItem(STORAGE_KEY_ZP);
    const sid = localStorage.getItem(STORAGE_KEY_SID);

    if (em) _cachedUserData.em = em;
    if (eid) _cachedUserData.external_id = eid;
    if (ph) _cachedUserData.ph = ph;
    if (fn) _cachedUserData.fn = fn;
    if (ln) _cachedUserData.ln = ln;
    if (ge) _cachedUserData.ge = ge;
    if (db) _cachedUserData.db = db;
    if (ct) _cachedUserData.ct = ct;
    if (st) _cachedUserData.st = st;
    if (zp) _cachedUserData.zp = zp;
    if (sid) _cachedUserData.subscription_id = sid;
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
  gender?: string | null;
  birthDate?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  subscriptionId?: string | null;
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
  if (userData.gender) {
    promises.push(sha256(userData.gender).then(hashed => {
      if (hashed) {
        matchData.ge = hashed;
        _cachedUserData.ge = hashed;
      }
    }));
  }
  if (userData.birthDate) {
    promises.push(sha256(userData.birthDate).then(hashed => {
      if (hashed) {
        matchData.db = hashed;
        _cachedUserData.db = hashed;
      }
    }));
  }
  if (userData.city) {
    promises.push(sha256(userData.city).then(hashed => {
      if (hashed) {
        matchData.ct = hashed;
        _cachedUserData.ct = hashed;
      }
    }));
  }
  if (userData.state) {
    promises.push(sha256(userData.state).then(hashed => {
      if (hashed) {
        matchData.st = hashed;
        _cachedUserData.st = hashed;
      }
    }));
  }
  if (userData.zip) {
    promises.push(sha256(userData.zip).then(hashed => {
      if (hashed) {
        matchData.zp = hashed;
        _cachedUserData.zp = hashed;
      }
    }));
  }
  if (userData.subscriptionId) {
    promises.push(sha256(userData.subscriptionId).then(hashed => {
      if (hashed) {
        matchData.subscription_id = hashed;
        _cachedUserData.subscription_id = hashed;
      }
    }));
  }

  await Promise.all(promises);

  // Always include country for Advanced Matching
  matchData.country = "br";

  persistUserData();

  /* Não chamar fbq('init') outra vez: index.html já inicializa (evita Duplicate Pixel ID).
   * Hashes ficam em storage e entram no CAPI via getUserData() + server-relay. */
  if (typeof window !== "undefined" && window.fbq) {
    _pixelInitWithAM = true;
    disableSpaAutoPageView();
  }
};

function headDidInitMetaPixel(): boolean {
  try {
    return (window as unknown as { __ROYAL_META_HEAD_INIT__?: boolean }).__ROYAL_META_HEAD_INIT__ === true;
  } catch {
    return false;
  }
}

/** Um único fbq('init') vem de index.html; aqui só disablePushState ou init fallback. */
const initPixel = () => {
  if (typeof window === "undefined" || !window.fbq || _pixelInitWithAM) return;

  if (headDidInitMetaPixel()) {
    _pixelInitWithAM = true;
    disableSpaAutoPageView();
    return;
  }

  const matchData: Record<string, string> = {};
  if (_cachedUserData.em) matchData.em = _cachedUserData.em;
  if (_cachedUserData.ph) matchData.ph = _cachedUserData.ph;
  if (_cachedUserData.fn) matchData.fn = _cachedUserData.fn;
  if (_cachedUserData.ln) matchData.ln = _cachedUserData.ln;
  if (_cachedUserData.ge) matchData.ge = _cachedUserData.ge;
  if (_cachedUserData.db) matchData.db = _cachedUserData.db;
  if (_cachedUserData.ct) matchData.ct = _cachedUserData.ct;
  if (_cachedUserData.st) matchData.st = _cachedUserData.st;
  if (_cachedUserData.zp) matchData.zp = _cachedUserData.zp;
  if (_cachedUserData.subscription_id) matchData.subscription_id = _cachedUserData.subscription_id;
  if (_cachedUserData.external_id) matchData.external_id = _cachedUserData.external_id;
  matchData.country = "br";

  _pixelInitWithAM = true;
  window.fbq("init", PIXEL_ID, Object.keys(matchData).length > 0 ? matchData : undefined);
  disableSpaAutoPageView();
};

// Head pode inicializar o pixel depois do bundle; re-tentar sem segundo fbq('init') quando flag existir.
if (typeof window !== "undefined") {
  const kick = () => initPixel();
  kick();
  window.addEventListener("load", kick);
  setTimeout(kick, 400);
  setTimeout(kick, 2000);
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
    localStorage.removeItem(STORAGE_KEY_GE);
    localStorage.removeItem(STORAGE_KEY_DB);
    localStorage.removeItem(STORAGE_KEY_CT);
    localStorage.removeItem(STORAGE_KEY_ST);
    localStorage.removeItem(STORAGE_KEY_ZP);
    localStorage.removeItem(STORAGE_KEY_SID);
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
  /** Nome ou slug do jogo (ex: "valorant", "fortnite"). Enviado como content_category. */
  contentCategory?: string;
  /** Segmentação estável de catálogo para Conversões Personalizadas. */
  section?: "contas" | "produtos" | "multi";
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
    if (_cachedUserData.ge) data.ge = _cachedUserData.ge;
    if (_cachedUserData.db) data.db = _cachedUserData.db;
    if (_cachedUserData.ct) data.ct = _cachedUserData.ct;
    if (_cachedUserData.st) data.st = _cachedUserData.st;
    if (_cachedUserData.zp) data.zp = _cachedUserData.zp;
    if (_cachedUserData.subscription_id) data.subscription_id = _cachedUserData.subscription_id;

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
    const headers = await relayAuthHeadersWithRetry();
    if (!headers) {
      devLog("sendCAPI skipped: no session token after retries (user not logged in or auth still loading)");
      return;
    }

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
      data_processing_options: [],
      data_processing_options_country: 0,
      data_processing_options_state: 0,
      user_data: userData,
      custom_data: safeCustom,
    });

    void fetch(url, {
      method: "POST",
      headers,
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
              data_processing_options: [],
              data_processing_options_country: 0,
              data_processing_options_state: 0,
              user_data: retryData,
              custom_data: safeCustom,
            });
            void fetch(url, {
              method: "POST",
              headers,
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

const IC_CART_FP_PREFIX = "_meta_ic_cart_";
/** Mesmo utilizador / mesmo carrinho: não repetir IC ao abrir outra aba ou voltar ao checkout dentro deste período. */
const IC_CART_FP_TTL_MS = 90 * 60 * 1000;

function isInitiateCheckoutFingerprintRecent(fp: string): boolean {
  const key = IC_CART_FP_PREFIX + fp;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (raw === "1") return true;
    const parsed = JSON.parse(raw) as { until?: number };
    if (typeof parsed?.until === "number" && Number.isFinite(parsed.until)) {
      if (Date.now() > parsed.until) {
        localStorage.removeItem(key);
        return false;
      }
      return true;
    }
    return true;
  } catch (e: unknown) {
    devLog("isInitiateCheckoutFingerprintRecent read failed", e);
    return false;
  }
}

function markInitiateCheckoutFingerprint(fp: string): void {
  try {
    localStorage.setItem(IC_CART_FP_PREFIX + fp, JSON.stringify({ until: Date.now() + IC_CART_FP_TTL_MS }));
  } catch (e: unknown) {
    devLog("markInitiateCheckoutFingerprint failed", e);
  }
}

type InitiateCheckoutOptions = { cartFingerprint?: string };

export const trackInitiateCheckout = (data: TrackingData, opts?: InitiateCheckoutOptions) => {
  if (typeof window === "undefined") return;

  const fp = String(opts?.cartFingerprint ?? "").trim();
  if (fp.length > 0) {
    if (isInitiateCheckoutFingerprintRecent(fp)) return;
    markInitiateCheckoutFingerprint(fp);
  }

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
    ...(data.contentCategory ? { content_category: data.contentCategory } : {}),
    ...(data.section ? { section: data.section } : {}),
  };

  runWhenFbqReady(() => {
    if (!window.fbq) return;
    try {
      window.fbq("track", "InitiateCheckout", customData, { eventID: eventId });
    } catch (e: unknown) {
      devLog("trackInitiateCheckout fbq failed", e);
    }
  });
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
    if (sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey)) return;
  } catch (e: unknown) {
    devLog("trackPurchase storage read failed", e);
  }
  _purchaseFiredThisDocument.add(tid);
  try {
    sessionStorage.setItem(storageKey, eventId);
    localStorage.setItem(storageKey, eventId);
  } catch (e: unknown) {
    devLog("trackPurchase storage write failed", e);
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
    ...(data.contentCategory ? { content_category: data.contentCategory } : {}),
    ...(data.section ? { section: data.section } : {}),
  };

  runWhenFbqReady(() => {
    if (!window.fbq) return;
    try {
      window.fbq("track", "Purchase", customData, { eventID: eventId });
    } catch (e: unknown) {
      devLog("trackPurchase fbq failed", e);
    }
  });
  sendCAPI("Purchase", eventId, customData);

  return eventId;
};

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.setTimeout(() => {
    try {
      if (window.fbq) return;
      if (window.__fbPixelLoadFailed === true) {
        console.info("[Royal Meta] fbevents.js não carregou (rede, CSP ou bloqueador).");
        return;
      }
      console.info(
        "[Royal Meta] Sem fbq no browser: em `vite dev` o Pixel está desligado por defeito — VITE_ENABLE_META_PIXEL_DEV=true no .env, ou `npm run build` + `vite preview`.",
      );
    } catch {
      /* ignore */
    }
  }, 5000);
}

