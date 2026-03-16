import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIXEL_ID = "4378225905838577";
const GRAPH_API_VERSION = "v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
  if (!ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { event_name, event_id, event_time, user_data, custom_data, event_source_url, action_source } = body;

    if (!event_name || !event_id) {
      return new Response(JSON.stringify({ error: "event_name and event_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Build user_data with server-side enrichment ───

    // Only allow Meta-accepted user_data fields (reject unknown fields)
    const ALLOWED_USER_DATA = new Set([
      "em", "ph", "fn", "ln", "ge", "db", "ct", "st", "zp", "country",
      "external_id", "client_ip_address", "client_user_agent",
      "fbp", "fbc", "fb_login_id", "lead_id",
    ]);

    const rawUserData = user_data || {};
    const userData: Record<string, any> = {};

    // Filter to only Meta-accepted fields
    for (const key of Object.keys(rawUserData)) {
      if (ALLOWED_USER_DATA.has(key) && rawUserData[key]) {
        userData[key] = rawUserData[key];
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

    // 3. Remove empty/undefined values
    for (const key of Object.keys(userData)) {
      if (userData[key] === undefined || userData[key] === null || userData[key] === "") {
        delete userData[key];
      }
    }

    const eventData: Record<string, any> = {
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

    // Retry up to 3 times on transient failures
    let lastError: any = null;
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

        // Non-retryable errors (bad params, auth) — return immediately
        if (metaRes.status >= 400 && metaRes.status < 500) {
          console.error("Meta CAPI error:", JSON.stringify(metaData));
          return new Response(JSON.stringify({ error: "Meta API error", details: metaData }), {
            status: metaRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Server error (5xx) — retry
        lastError = metaData;
        console.error(`Meta CAPI attempt ${attempt}/3 failed (${metaRes.status}):`, JSON.stringify(metaData));
      } catch (fetchErr) {
        lastError = fetchErr;
        console.error(`Meta CAPI attempt ${attempt}/3 network error:`, fetchErr);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    // All retries exhausted
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
