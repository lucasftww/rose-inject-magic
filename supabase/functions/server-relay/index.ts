import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v21.0";
const DEFAULT_PIXEL_ID = "706054019233816";

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
    const [capiTokenRow, pixelIdRow] = await Promise.all([
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "META_ACCESS_TOKEN").maybeSingle(),
      supabaseAdmin.from("system_credentials").select("value").eq("env_key", "META_PIXEL_ID").maybeSingle(),
    ]);

    const ACCESS_TOKEN = capiTokenRow.data?.value || Deno.env.get("META_ACCESS_TOKEN");
    const PIXEL_ID = pixelIdRow.data?.value || Deno.env.get("META_PIXEL_ID") || DEFAULT_PIXEL_ID;

    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event_name, event_id, event_time, user_data, custom_data, event_source_url, action_source } = body;

    if (!event_name || !event_id) {
      return new Response(JSON.stringify({ error: "event_name and event_id are required" }), {
        status: 400,
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
      "fbp", "fbc", "fb_login_id", "lead_id",
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

    const eventData: Record<string, unknown> = {
      event_name,
      event_id,
      event_time: event_time || Math.floor(Date.now() / 1000),
      action_source: action_source || "website",
      event_source_url,
      user_data: userData,
      custom_data: custom_data || {},
    };

    const payload = { data: [eventData] };

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const bodyStr = JSON.stringify(payload);

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

        if (metaRes.status >= 400 && metaRes.status < 500) {
          console.error("Meta CAPI error:", JSON.stringify(metaData));
          return new Response(JSON.stringify({ error: "Meta API error", details: metaData }), {
            status: metaRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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