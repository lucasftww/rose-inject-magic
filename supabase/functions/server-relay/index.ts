import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v21.0";
const DEFAULT_PIXEL_ID = "706054019233816";
const DEFAULT_ALLOWED_ORIGIN_HOSTS = ["royalstorebr.com", "www.royalstorebr.com", "localhost", "127.0.0.1"];
const MAX_EVENTS_PER_MINUTE_PER_IP = 120;
const ipWindow = new Map<string, { windowStartMs: number; count: number }>();

/** Código "Testar eventos" no Events Manager — só credenciais/servidor (nunca confiar no body do cliente). */
function resolveMetaTestEventCode(dbValue: string | null | undefined, envValue: string | undefined): string | undefined {
  const raw = String(dbValue ?? "").trim() || String(envValue ?? "").trim();
  if (raw.length < 4 || raw.length > 64) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return undefined;
  return raw;
}

/** Meta CAPI custom_data: only safe shapes to reduce 400 from Graph API. */
function sanitizeCustomData(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;

  if (typeof o.content_name === "string") {
    out.content_name = o.content_name.trim().slice(0, 500);
  }
  if (typeof o.content_category === "string") {
    out.content_category = o.content_category.trim().slice(0, 200);
  }
  if (Array.isArray(o.content_ids)) {
    out.content_ids = o.content_ids.map((id) => String(id)).filter(Boolean).slice(0, 100);
  }
  if (Array.isArray(o.contents)) {
    out.contents = o.contents
      .filter((c): c is Record<string, unknown> => c != null && typeof c === "object" && !Array.isArray(c))
      .map((c) => ({
        id: String(c.id ?? ""),
        quantity: Math.max(1, Math.min(1000, Math.floor(Number(c.quantity) || 1))),
      }))
      .filter((c) => c.id.length > 0)
      .slice(0, 100);
  }
  if (typeof o.content_type === "string") {
    out.content_type = o.content_type.trim().slice(0, 50);
  }
  if (typeof o.section === "string") {
    out.section = o.section.trim().slice(0, 50);
  }
  if (o.value != null) {
    const v = Number(o.value);
    if (Number.isFinite(v) && v >= 0) out.value = Math.round(v * 100) / 100;
  }
  if (typeof o.currency === "string" && /^[A-Za-z]{3}$/.test(o.currency)) {
    out.currency = o.currency.toUpperCase();
  }
  if (typeof o.transaction_id === "string") {
    out.transaction_id = o.transaction_id.trim().slice(0, 200);
  }
  return out;
}

function resolveEventSourceUrl(
  bodyUrl: unknown,
  req: Request,
): string | undefined {
  const u = typeof bodyUrl === "string" ? bodyUrl.trim() : "";
  if (u.startsWith("http://") || u.startsWith("https://")) {
    return u.slice(0, 2048);
  }
  const referer = req.headers.get("referer")?.trim();
  if (referer && (referer.startsWith("http://") || referer.startsWith("https://"))) {
    return referer.slice(0, 2048);
  }
  const origin = req.headers.get("origin")?.trim();
  if (origin && (origin.startsWith("http://") || origin.startsWith("https://"))) {
    return origin.slice(0, 2048);
  }
  return undefined;
}

function isAllowedHost(hostname: string, allowlist: Set<string>): boolean {
  const normalized = hostname.toLowerCase();
  if (allowlist.has(normalized)) return true;
  for (const allowed of allowlist) {
    if (allowed.startsWith(".")) {
      if (normalized.endsWith(allowed)) return true;
      continue;
    }
    if (normalized === allowed) return true;
  }
  return false;
}

function parseAllowedOriginHosts(): Set<string> {
  const raw = String(Deno.env.get("META_ALLOWED_ORIGIN_HOSTS") || "").trim();
  const values = raw
    ? raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGIN_HOSTS;
  return new Set(values);
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const row = ipWindow.get(clientIp);
  if (!row || now - row.windowStartMs >= 60_000) {
    ipWindow.set(clientIp, { windowStartMs: now, count: 1 });
    return false;
  }
  row.count += 1;
  return row.count > MAX_EVENTS_PER_MINUTE_PER_IP;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("server-relay: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const [capiTokenRow, pixelIdRow, testCodeRow] = await Promise.all([
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "META_ACCESS_TOKEN").maybeSingle(),
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "META_PIXEL_ID").maybeSingle(),
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "META_TEST_EVENT_CODE").maybeSingle(),
    ]);

    const ACCESS_TOKEN = capiTokenRow.data?.value || Deno.env.get("META_ACCESS_TOKEN");
    const PIXEL_ID = pixelIdRow.data?.value || Deno.env.get("META_PIXEL_ID") || DEFAULT_PIXEL_ID;
    const META_TEST_EVENT_CODE = resolveMetaTestEventCode(
      testCodeRow.data?.value as string | undefined,
      Deno.env.get("META_TEST_EVENT_CODE"),
    );

    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const {
      event_name,
      event_id,
      event_time,
      user_data,
      custom_data,
      event_source_url,
      action_source,
      data_processing_options,
      data_processing_options_country,
      data_processing_options_state,
    } = body;

    if (!event_name || !event_id) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "missing event_name or event_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof event_id !== "string" || event_id.trim().length < 4 || event_id.trim().length > 200) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "invalid event_id format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow InitiateCheckout and Purchase (rest is manual pixel only)
    if (event_name !== "InitiateCheckout" && event_name !== "Purchase") {
      console.log(`Relay skipped event: ${event_name}. Only InitiateCheckout and Purchase are allowed.`);
      return new Response(JSON.stringify({ success: true, message: "Event ignored by policy" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // ─── Build user_data with server-side enrichment ───

    const ALLOWED_USER_DATA = new Set([
      "em", "ph", "fn", "ln", "ge", "db", "ct", "st", "zp", "country",
      "external_id", "client_ip_address", "client_user_agent",
      "fbp", "fbc", "fb_login_id", "lead_id", "subscription_id",
    ]);

    const rawUserData = (user_data || {}) as Record<string, unknown>;
    const userData: Record<string, unknown> = {};

    for (const key of Object.keys(rawUserData)) {
      const val = rawUserData[key];
      if (ALLOWED_USER_DATA.has(key) && val != null && val !== "") {
        userData[key] = val;
      }
    }

    // 1. Client IP — extracted server-side (most reliable)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      null;
    if (clientIp && isRateLimited(clientIp)) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "rate_limited" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (clientIp) {
      userData.client_ip_address = clientIp;
    }

    // 2. User Agent — prefer client-sent, fallback to request header
    if (!userData.client_user_agent) {
      userData.client_user_agent = req.headers.get("user-agent") || undefined;
    }

    // 3. Country — always set to hashed "br" if not provided (all users are Brazilian)
    if (!userData.country) {
      // SHA-256 of "br"
      const encoder = new TextEncoder();
      const data = encoder.encode("br");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      userData.country = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // 4. Remove empty/undefined values
    for (const key of Object.keys(userData)) {
      if (userData[key] === undefined || userData[key] === null || userData[key] === "") {
        delete userData[key];
      }
    }

    const safeCustom = sanitizeCustomData(custom_data);
    const resolvedUrl = resolveEventSourceUrl(event_source_url, req);
    const allowedHosts = parseAllowedOriginHosts();
    if (resolvedUrl) {
      try {
        const hostname = new URL(resolvedUrl).hostname;
        if (!isAllowedHost(hostname, allowedHosts)) {
          return new Response(JSON.stringify({ success: true, ignored: true, reason: "origin_not_allowed" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: "invalid_event_source_url" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const eventData: Record<string, unknown> = {
      event_name,
      event_id,
      event_time: typeof event_time === "number" && Number.isFinite(event_time)
        ? event_time
        : Math.floor(Date.now() / 1000),
      action_source: typeof action_source === "string" && action_source ? action_source : "website",
      ...(resolvedUrl ? { event_source_url: resolvedUrl } : {}),
      user_data: userData,
      custom_data: safeCustom,
    };

    const graphPayload: Record<string, unknown> = { data: [eventData] };
    if (Array.isArray(data_processing_options)) {
      graphPayload.data_processing_options = data_processing_options
        .filter((v): v is string => typeof v === "string")
        .slice(0, 5);
    }
    if (typeof data_processing_options_country === "number" && Number.isFinite(data_processing_options_country)) {
      graphPayload.data_processing_options_country = Math.max(0, Math.trunc(data_processing_options_country));
    }
    if (typeof data_processing_options_state === "number" && Number.isFinite(data_processing_options_state)) {
      graphPayload.data_processing_options_state = Math.max(0, Math.trunc(data_processing_options_state));
    }
    if (META_TEST_EVENT_CODE) graphPayload.test_event_code = META_TEST_EVENT_CODE;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const bodyStr = JSON.stringify(graphPayload);

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const metaRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyStr,
        });

        const metaData = await metaRes.json();

        if (metaRes.ok) {
          return new Response(JSON.stringify({ success: true, ...metaData }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Return HTTP 200 so the browser fetch does not surface a red "400" for Meta-side
        // validation/token issues; details are still logged and returned in JSON.
        if (metaRes.status >= 400 && metaRes.status < 500) {
          console.error("Meta CAPI client error:", metaRes.status, JSON.stringify(metaData));
          return new Response(
            JSON.stringify({
              success: false,
              relay: "meta_client_error",
              metaHttpStatus: metaRes.status,
              details: metaData,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        lastError = metaData;
        console.error(`Meta CAPI attempt ${attempt}/3 failed (${metaRes.status}):`, JSON.stringify(metaData));
      } catch (fetchErr) {
        lastError = fetchErr;
        console.error(`Meta CAPI attempt ${attempt}/3 network error:`, fetchErr);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    return new Response(JSON.stringify({ error: "Meta API failed after 3 attempts", details: lastError }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CAPI function error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});