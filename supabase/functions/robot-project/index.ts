import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROBOT_API_URL = "https://api.robotproject.com.br";

function log(level: "INFO" | "WARN" | "ERROR", ctx: string, msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, ctx, msg, ...(data || {}) };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

async function getRobotCredentials(supabaseAdmin: any): Promise<{ username: string; password: string } | null> {
  const [uRes, pRes] = await Promise.all([
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_USERNAME").maybeSingle(),
    supabaseAdmin.from("system_credentials").select("value").eq("env_key", "ROBOT_API_PASSWORD").maybeSingle(),
  ]);
  const username = uRes.data?.value;
  const password = pRes.data?.value;
  if (!username || !password) return null;
  return { username, password };
}

function robotAuthHeader(creds: { username: string; password: string }): string {
  // Deno supports btoa for Base64 encoding
  return "Basic " + btoa(`${creds.username}:${creds.password}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      log("ERROR", "robot-project", "Missing Supabase env");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const getAuthUser = async () => {
      if (!authHeader?.startsWith("Bearer ")) return null;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      return error ? null : user;
    };

    // Check admin
    const requireAdmin = async () => {
      const user = await getAuthUser();
      if (!user) return null;
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return adminRole ? user : null;
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list-games";

    // LIST GAMES - Admin only
    if (action === "list-games") {
      const admin = await requireAdmin();
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creds = await getRobotCredentials(supabaseAdmin);
      if (!creds) {
        return new Response(JSON.stringify({ error: "Robot Project credentials not configured. Add ROBOT_API_USERNAME and ROBOT_API_PASSWORD in Credentials." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(`${ROBOT_API_URL}/games`, {
        headers: {
          Authorization: robotAuthHeader(creds),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        log("ERROR", "list-games", "Robot API error", { status: response.status, body: errText.substring(0, 300) });
        return new Response(JSON.stringify({ error: "Robot API error", status: response.status }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BUY - Server-side only (called from fulfillment, requires admin or service context)
    if (action === "buy" && req.method === "POST") {
      // This endpoint is called internally from pix-payment fulfillment
      // Validate it's either admin or has a special internal header
      const admin = await requireAdmin();
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creds = await getRobotCredentials(supabaseAdmin);
      if (!creds) {
        return new Response(JSON.stringify({ error: "Robot credentials not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { game_id, duration } = body;

      if (!game_id || !duration) {
        return new Response(JSON.stringify({ error: "game_id and duration required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      log("INFO", "buy", "Robot buy request", { game_id, duration });

      // Robot API: jogos is_free não retornam chave; POST /buy não deve ser usado — só loader via GET /games.
      const gamesRes = await fetch(`${ROBOT_API_URL}/games`, {
        headers: {
          Authorization: robotAuthHeader(creds),
          "Content-Type": "application/json",
        },
      });
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        const games = Array.isArray(gamesData) ? gamesData : gamesData.games || [];
        const g = games.find((x: { id?: unknown }) => Number(x.id) === Number(game_id)) as
          | { id?: unknown; is_free?: boolean; isFree?: boolean }
          | undefined;
        if (g && (g.is_free === true || g.isFree === true)) {
          return new Response(
            JSON.stringify({
              error:
                "Jogo gratuito: a API Robot não emite chave nem deve receber POST /buy. Use o link do loader em GET /games; o cliente cria conta no loader sem ativação.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const response = await fetch(`${ROBOT_API_URL}/buy/${encodeURIComponent(game_id)}`, {
        method: "POST",
        headers: {
          Authorization: robotAuthHeader(creds),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ duration: Number(duration) }),
      });

      const data = await response.json();
      log("INFO", "buy", "Robot buy response", { status: response.status, data: JSON.stringify(data).substring(0, 500) });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Robot buy failed", status: response.status, detail: data }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHECK BALANCE / PING - Admin only
    if (action === "ping") {
      const admin = await requireAdmin();
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creds = await getRobotCredentials(supabaseAdmin);
      if (!creds) {
        return new Response(JSON.stringify({ error: "Robot credentials not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(`${ROBOT_API_URL}/ping`, {
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log("ERROR", "robot-project", "Edge function error", { error: (error as Error).message });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
