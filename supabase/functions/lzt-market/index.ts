import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Helper: authenticate user (returns null if not authenticated)
    const getAuthUser = async () => {
      if (!authHeader?.startsWith("Bearer ")) return null;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      return error ? null : user;
    };

    // Fetch LZT token from system_credentials table
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: credRow } = await supabaseAdmin
      .from("system_credentials")
      .select("value")
      .eq("env_key", "LZT_API_TOKEN")
      .maybeSingle();

    const token = credRow?.value || Deno.env.get("LZT_MARKET_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "LZT token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Require authentication for ALL actions
    const user = await getAuthUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const itemId = url.searchParams.get("item_id");

    // IMAGE PROXY: Proxy image requests to bypass CORS
    if (action === "image-proxy") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "url parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow proxying from known LZT domains
      const allowedDomains = ["lzt.market", "api.lzt.market", "s.lzt.market", "img.lzt.market"];
      try {
        const parsedUrl = new URL(imageUrl);
        if (!allowedDomains.some(d => parsedUrl.hostname.endsWith(d))) {
          return new Response(JSON.stringify({ error: "Domain not allowed" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(imageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Image fetch failed", status: response.status }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageData = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "image/png";

      return new Response(imageData, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // FAST-BUY: Purchase an account - ADMIN ONLY
    if (action === "fast-buy" && req.method === "POST") {
      // SECURITY: admin only
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { item_id, price, currency } = body;

      if (!item_id || !price) {
        return new Response(JSON.stringify({ error: "item_id and price required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buyUrl = `https://api.lzt.market/${encodeURIComponent(item_id)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;
      console.log("Fast-buy:", buyUrl);

      const response = await fetch(buyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();
      console.log("Fast-buy response:", response.status, JSON.stringify(data).substring(0, 500));

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "LZT fast-buy failed", status: response.status, detail: data }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lzt_config once for both list and detail actions
    const { data: lztConfig } = await supabaseAdmin
      .from("lzt_config")
      .select("max_fetch_price, currency, markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
      .limit(1)
      .maybeSingle();

    // DETAIL: Get single item
    let apiUrl: string;
    if (action === "detail" && itemId) {
      apiUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}`;
    } else {
      // LIST: accounts with filters
      const maxFetchPrice = lztConfig?.max_fetch_price || 500;

      // Determine which markup applies based on game_type to calculate real pmax
      const gameType = url.searchParams.get("game_type") || "riot";
      let activeMarkup = lztConfig?.markup_multiplier || 1.5;
      if (gameType === "riot") activeMarkup = lztConfig?.markup_valorant || activeMarkup;
      else if (gameType === "fortnite") activeMarkup = lztConfig?.markup_fortnite || activeMarkup;
      else if (gameType === "minecraft") activeMarkup = lztConfig?.markup_minecraft || activeMarkup;

      // The admin sets the max FINAL price (after markup). Divide by markup to get LZT pmax.
      const effectivePmax = Math.floor(maxFetchPrice / activeMarkup);

      const params = new URLSearchParams();
      const allowedParams = [
        "page", "pmin", "pmax", "title", "order_by", "currency",
        "rmin", "rmax", "last_rmin", "last_rmax", "previous_rmin", "previous_rmax",
        "valorant_level_min", "valorant_level_max",
        "valorant_smin", "valorant_smax",
        "valorant_knife_min", "valorant_knife_max",
        "vp_min", "vp_max", "rp_min", "rp_max",
        "fa_min", "fa_max",
        "inv_min", "inv_max",
        "knife", "nsb",
        "amin", "amax",
        // LoL params
        "lol_level_min", "lol_level_max",
        "lol_smin", "lol_smax",
        "champion_min", "champion_max",
        "win_rate_min", "win_rate_max",
        "blue_min", "blue_max",
        "orange_min", "orange_max",
      ];

      for (const p of allowedParams) {
        const val = url.searchParams.get(p);
        if (val) params.set(p, val);
      }

      const arrayParams = [
        "weaponSkin[]", "buddy[]", "agent[]", "valorant_region[]",
        "valorant_rank_type[]", "email_type[]", "country[]",
        "champion[]", "skin[]", "lol_rank[]", "lol_region[]",
      ];
      for (const p of arrayParams) {
        const vals = url.searchParams.getAll(p);
        for (const v of vals) {
          params.append(p, v);
        }
      }

      // Enforce effective pmax (max_fetch_price / markup) as ceiling
      const currentPmax = params.get("pmax");
      if (!currentPmax || Number(currentPmax) > effectivePmax) {
        params.set("pmax", String(effectivePmax));
      }

      // gameType already determined above
      if (gameType === "fortnite") {
        // Fortnite-specific params
        const fortniteParams = ["vbmin", "vbmax", "smin", "smax", "eg"];
        for (const p of fortniteParams) {
          const val = url.searchParams.get(p);
          if (val) params.set(p, val);
        }
        apiUrl = `https://api.lzt.market/fortnite?${params.toString()}`;
      } else if (gameType === "minecraft") {
        // Minecraft-specific params
        const mcParams = [
          "java", "bedrock", "dungeons", "legends", "change_nickname",
          "capes_min", "capes_max", "hypixel_ban", "level_hypixel_min", "level_hypixel_max",
          "achievement_hypixel_min", "achievement_hypixel_max", "minecoins_min", "minecoins_max",
          "nickname_length_min", "nickname_length_max",
        ];
        for (const p of mcParams) {
          const val = url.searchParams.get(p);
          if (val) params.set(p, val);
        }
        const mcArrayParams = ["rank_hypixel[]", "capes[]", "country[]"];
        for (const p of mcArrayParams) {
          const vals = url.searchParams.getAll(p);
          for (const v of vals) params.append(p, v);
        }
        apiUrl = `https://api.lzt.market/minecraft?${params.toString()}`;
      } else {
        apiUrl = `https://api.lzt.market/riot?${params.toString()}`;
      }
    }

    console.log("Fetching:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LZT API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "LZT API error", status: response.status, detail: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    // Filter out accounts with less than 30 days of inactivity
    if (data.items && Array.isArray(data.items)) {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      data.items = data.items.filter((item: any) => {
        const lastActivity = item.riot_last_activity || item.account_last_activity || 0;
        return lastActivity === 0 || lastActivity <= thirtyDaysAgo;
      });

      // Add price_brl (with markup) to each item so client doesn't need markup config
      const RUB_TO_BRL = 0.055;
      const MIN_PRICE_BRL = 20;
      const gameType = url.searchParams.get("game_type") || "riot";
      let itemMarkup = lztConfig?.markup_multiplier || 1.5;
      if (gameType === "riot") itemMarkup = lztConfig?.markup_valorant || itemMarkup;
      else if (gameType === "fortnite") itemMarkup = lztConfig?.markup_fortnite || itemMarkup;
      else if (gameType === "minecraft") itemMarkup = lztConfig?.markup_minecraft || itemMarkup;

      for (const item of data.items) {
        const currency = item.price_currency || "rub";
        let brl = currency === "rub" ? item.price * RUB_TO_BRL : item.price;
        const final = brl * itemMarkup;
        item.price_brl = final < MIN_PRICE_BRL ? MIN_PRICE_BRL : Math.round(final * 100) / 100;
      }
    }

    // For detail action, also add price_brl
    if (action === "detail" && data.item) {
      const RUB_TO_BRL = 0.055;
      const MIN_PRICE_BRL = 20;
      // Detect game type from the item's category or URL param
      const detailGameType = url.searchParams.get("game_type") || "";
      let detailMarkup = lztConfig?.markup_multiplier || 1.5;
      if (detailGameType === "valorant" || detailGameType === "riot") detailMarkup = lztConfig?.markup_valorant || detailMarkup;
      else if (detailGameType === "lol") detailMarkup = lztConfig?.markup_lol || detailMarkup;
      else if (detailGameType === "fortnite") detailMarkup = lztConfig?.markup_fortnite || detailMarkup;
      else if (detailGameType === "minecraft") detailMarkup = lztConfig?.markup_minecraft || detailMarkup;
      else detailMarkup = lztConfig?.markup_valorant || detailMarkup; // fallback to valorant
      const currency = data.item.price_currency || "rub";
      let brl = currency === "rub" ? data.item.price * RUB_TO_BRL : data.item.price;
      const final = brl * detailMarkup;
      data.item.price_brl = final < MIN_PRICE_BRL ? MIN_PRICE_BRL : Math.round(final * 100) / 100;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
