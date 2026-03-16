import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use anon key client with user's auth header to validate token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      console.error("Auth validation error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;

    // Service role client for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body safely (invoke always sends POST)
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch { /* empty body = list users */ }

    const { action, target_user_id, reason } = body;

    // If no action, list users
    if (!action) {
      // Helper to fetch all rows with pagination (bypasses 1000-row limit)
      async function fetchAllRows(table: string, select: string, orderCol?: string, orderAsc?: boolean) {
        let allData: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        while (true) {
          let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
          if (orderCol) query = query.order(orderCol, { ascending: orderAsc ?? false });
          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        return allData;
      }

      // Paginate listUsers to handle >1000 users
      let users: any[] = [];
      let page = 1;
      while (true) {
        const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) throw listError;
        if (!data.users || data.users.length === 0) break;
        users = users.concat(data.users);
        if (data.users.length < 1000) break;
        page++;
      }

      const [profiles, roles, ips, payments, tickets, products, plans, stockItems] = await Promise.all([
        fetchAllRows("profiles", "user_id, username, avatar_url, banned, banned_at, banned_reason"),
        fetchAllRows("user_roles", "user_id, role"),
        fetchAllRows("user_login_ips", "user_id, ip_address, logged_at", "logged_at", false),
        fetchAllRows("payments", "user_id, amount, status, created_at, cart_snapshot", "created_at", false),
        fetchAllRows("order_tickets", "id, user_id, product_id, product_plan_id, stock_item_id, status, status_label, created_at", "created_at", false),
        fetchAllRows("products", "id, name, image_url"),
        fetchAllRows("product_plans", "id, name, price"),
        fetchAllRows("stock_items", "id, content"),
      ]);

      const productMap = new Map(products.map((p: any) => [p.id, p]));
      const planMap = new Map(plans.map((p: any) => [p.id, p]));
      const stockMap = new Map(stockItems.map((s: any) => [s.id, s]));

      const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
      const roleMap = new Map<string, string[]>();
      roles.forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const ipMap = new Map<string, { ip_address: string; logged_at: string }[]>();
      ips.forEach((ip: any) => {
        const existing = ipMap.get(ip.user_id) || [];
        if (existing.length < 1) existing.push({ ip_address: ip.ip_address, logged_at: ip.logged_at });
        ipMap.set(ip.user_id, existing);
      });

      // Calculate total spent, total orders, and recent payments per user
      const spentMap = new Map<string, number>();
      const ordersMap = new Map<string, number>();
      const recentPaymentsMap = new Map<string, any[]>();
      payments.forEach((p: any) => {
        // Only count COMPLETED payments for total spent
        if (p.status === "COMPLETED") {
          spentMap.set(p.user_id, (spentMap.get(p.user_id) || 0) + p.amount);
        }
        const existing = recentPaymentsMap.get(p.user_id) || [];
        if (existing.length < 5) existing.push({ amount: p.amount, status: p.status, created_at: p.created_at, cart_snapshot: p.cart_snapshot });
        recentPaymentsMap.set(p.user_id, existing);
      });
      const userOrdersMap = new Map<string, any[]>();
      (tickets || []).forEach((t: any) => {
        ordersMap.set(t.user_id, (ordersMap.get(t.user_id) || 0) + 1);
        const existing = userOrdersMap.get(t.user_id) || [];
        const prod = productMap.get(t.product_id);
        const plan = planMap.get(t.product_plan_id);
        const stock = t.stock_item_id ? stockMap.get(t.stock_item_id) : null;
        existing.push({
          id: t.id,
          product_name: prod?.name || "Produto",
          product_image: prod?.image_url || null,
          plan_name: plan?.name || "Plano",
          plan_price: plan?.price || 0,
          status: t.status,
          status_label: t.status_label,
          created_at: t.created_at,
          stock_content: stock?.content ? (typeof stock.content === "string" ? stock.content : JSON.stringify(stock.content)) : null,
        });
        userOrdersMap.set(t.user_id, existing);
      });

      const result = (users || []).map((u: any) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email || "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          banned: profile?.banned || false,
          banned_at: profile?.banned_at || null,
          banned_reason: profile?.banned_reason || null,
          roles: roleMap.get(u.id) || [],
          login_ips: ipMap.get(u.id) || [],
          total_spent: spentMap.get(u.id) || 0,
          total_orders: ordersMap.get(u.id) || 0,
          recent_payments: recentPaymentsMap.get(u.id) || [],
          orders: userOrdersMap.get(u.id) || [],
          provider: u.app_metadata?.provider || "email",
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action handling
    {
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-actions
      if (target_user_id === callerId && (action === "ban" || action === "remove_admin")) {
        return new Response(JSON.stringify({ error: "Não é possível executar esta ação em si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      switch (action) {
        case "ban": {
          await supabase.from("profiles").update({
            banned: true,
            banned_at: new Date().toISOString(),
            banned_reason: reason || "Banido pelo admin",
          }).eq("user_id", target_user_id);

          return new Response(JSON.stringify({ ok: true, message: "Usuário banido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        case "unban": {
          await supabase.from("profiles").update({
            banned: false,
            banned_at: null,
            banned_reason: null,
          }).eq("user_id", target_user_id);

          return new Response(JSON.stringify({ ok: true, message: "Usuário desbanido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        case "add_admin": {
          const { error } = await supabase.from("user_roles").insert({
            user_id: target_user_id,
            role: "admin",
          });
          if (error && error.code === "23505") {
            return new Response(JSON.stringify({ error: "Usuário já é admin" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (error) throw error;
          return new Response(JSON.stringify({ ok: true, message: "Admin adicionado" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        case "remove_admin": {
          await supabase.from("user_roles").delete()
            .eq("user_id", target_user_id)
            .eq("role", "admin");
          return new Response(JSON.stringify({ ok: true, message: "Admin removido" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        default:
          return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
