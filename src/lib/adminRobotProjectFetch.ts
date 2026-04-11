import { getUsdToBrl } from "@/lib/adminCache";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { paymentCartSnapshot } from "@/types/paymentCart";
import { asOrderTicketMetadata } from "@/types/orderTicketMetadata";

export type RobotProjectSalesPeriod = "7d" | "30d" | "all";

export interface RobotGame {
  id: number;
  name: string;
  version: string;
  status: string;
  icon: string;
  is_free?: boolean;
  isFree?: boolean;
  prices: Record<string, number>;
  maxKeys: number | null;
  soldKeys: number;
}

export interface ProductWithRobot {
  id: string;
  name: string;
  image_url: string | null;
  robot_game_id: number | null;
  robot_markup_percent: number | null;
  hasStock: boolean;
  stockCount: number;
}

export interface RobotSale {
  id: string;
  created_at: string;
  product_name: string;
  plan_name: string;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  duration: number | null;
}

export interface PendingRobotTicket {
  id: string;
  created_at: string;
  status: string;
  status_label: string;
  error: string;
  product_name: string;
  plan_name: string;
  user_label: string;
}

export type AdminRobotProjectBundle = {
  pingOnline: boolean;
  robotGames: RobotGame[];
  freeGamesCount: number;
  usdToBrl: number;
  productsWithRobot: ProductWithRobot[];
  robotSales: RobotSale[];
  pendingRobotTickets: PendingRobotTicket[];
};

async function fetchProductsWithRobot(): Promise<ProductWithRobot[]> {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_url, robot_game_id, robot_markup_percent")
    .not("robot_game_id", "is", null)
    .eq("active", true);

  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const { data: plans } = await supabase
    .from("product_plans")
    .select("id, product_id")
    .in("product_id", productIds)
    .eq("active", true);

  const planIds = (plans || []).map((p) => p.id);
  const planToProduct: Record<string, string> = {};
  (plans || []).forEach((p) => {
    planToProduct[p.id] = p.product_id;
  });

  const stockCounts: Record<string, number> = {};
  if (planIds.length > 0) {
    const stockPromises = planIds.map(async (planId: string) => {
      const { count } = await supabase
        .from("stock_items")
        .select("id", { count: "exact", head: true })
        .eq("product_plan_id", planId)
        .eq("used", false);
      const productId = planToProduct[planId];
      if (productId) stockCounts[productId] = (stockCounts[productId] || 0) + (count || 0);
    });
    await Promise.all(stockPromises);
  }

  return products.map((p) => ({
    ...p,
    hasStock: (stockCounts[p.id] || 0) > 0,
    stockCount: stockCounts[p.id] || 0,
  }));
}

async function fetchPendingRobotTickets(): Promise<PendingRobotTicket[]> {
  type RobotTicketRow = Pick<
    Tables<"order_tickets">,
    "id" | "created_at" | "status" | "status_label" | "metadata" | "product_id" | "product_plan_id" | "user_id"
  >;

  const { data: tickets } = await supabase
    .from("order_tickets")
    .select("id, created_at, status, status_label, metadata, product_id, product_plan_id, user_id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  const robotTickets = (tickets ?? []).filter((ticket): ticket is RobotTicketRow => {
    const m = asOrderTicketMetadata(ticket.metadata);
    return m.type === "robot-project";
  });
  if (robotTickets.length === 0) return [];

  const productIds = [...new Set(robotTickets.map((ticket) => ticket.product_id))];
  const planIds = [...new Set(robotTickets.map((ticket) => ticket.product_plan_id))];
  const userIds = [...new Set(robotTickets.map((ticket) => ticket.user_id))];

  const [productsRes, plansRes, profilesRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    planIds.length > 0
      ? supabase.from("product_plans").select("id, name").in("id", planIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, username").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; username: string | null }[] }),
  ]);

  const productMap = Object.fromEntries((productsRes.data || []).map((item) => [item.id, item.name]));
  const planMap = Object.fromEntries((plansRes.data || []).map((item) => [item.id, item.name]));
  const profileMap = Object.fromEntries(
    (profilesRes.data || []).map((item) => [item.user_id, item.username || item.user_id.slice(0, 8)]),
  );

  return robotTickets.map((ticket) => {
    const meta = asOrderTicketMetadata(ticket.metadata);
    return {
      id: ticket.id,
      created_at: ticket.created_at || "",
      status: ticket.status || "open",
      status_label: ticket.status_label || "Aguardando Entrega",
      error: String(meta.error ?? "Falha não informada"),
      product_name: productMap[ticket.product_id] || "Produto desconhecido",
      plan_name: planMap[ticket.product_plan_id] || "Plano desconhecido",
      user_label: profileMap[ticket.user_id] || ticket.user_id.slice(0, 8),
    };
  });
}

async function fetchRobotSalesForPeriod(period: RobotProjectSalesPeriod, rate: number): Promise<RobotSale[]> {
  const { data: robotProducts } = await supabase
    .from("products")
    .select("id, name, robot_game_id, robot_markup_percent")
    .not("robot_game_id", "is", null);

  if (!robotProducts || robotProducts.length === 0) return [];

  const productIds = robotProducts.map((p) => p.id);
  const productMap = Object.fromEntries(robotProducts.map((p) => [p.id, p]));

  let dateFilter: string | null = null;
  if (period === "7d") {
    dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (period === "30d") {
    dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  type RobotTicketRow = Pick<
    Database["public"]["Tables"]["order_tickets"]["Row"],
    "id" | "created_at" | "product_id" | "product_plan_id" | "status" | "metadata" | "user_id"
  >;

  let allTickets: RobotTicketRow[];
  if (dateFilter) {
    allTickets = await fetchAllRows<RobotTicketRow>("order_tickets", {
      select: "id, created_at, product_id, product_plan_id, status, metadata, user_id",
      filters: [
        { column: "status", op: "eq", value: "delivered" },
        { column: "created_at", op: "gte", value: dateFilter },
      ],
      order: { column: "created_at", ascending: false },
    });
  } else {
    allTickets = await fetchAllRows<RobotTicketRow>("order_tickets", {
      select: "id, created_at, product_id, product_plan_id, status, metadata, user_id",
      filters: [{ column: "status", op: "eq", value: "delivered" }],
      order: { column: "created_at", ascending: false },
    });
  }

  const tickets = allTickets.filter(
    (t) => productIds.includes(t.product_id) && asOrderTicketMetadata(t.metadata).type !== "lzt-account",
  );
  if (tickets.length === 0) return [];

  const planIds = [...new Set(tickets.map((t) => t.product_plan_id).filter(Boolean))];
  const ticketUserIds = [...new Set(tickets.map((t) => t.user_id))];

  const [plansRes, robotPayments] = await Promise.all([
    planIds.length > 0
      ? supabase.from("product_plans").select("id, name, price, robot_duration_days").in("id", planIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number; robot_duration_days: number | null }[] }),
    (async () => {
      const batchSize = 50;
      const allPayments: { user_id: string; amount: number; cart_snapshot: Json | undefined; status: string }[] = [];
      for (let i = 0; i < ticketUserIds.length; i += batchSize) {
        const batch = ticketUserIds.slice(i, i + batchSize);
        const rows = await fetchAllRows("payments", {
          select: "user_id, amount, cart_snapshot, status",
          filters: [
            { column: "status", op: "eq", value: "COMPLETED" },
            { column: "user_id", op: "in", value: batch },
          ],
          order: { column: "created_at", ascending: false },
        });
        allPayments.push(...(rows as typeof allPayments));
      }
      return allPayments;
    })(),
  ]);

  const planMap = Object.fromEntries((plansRes.data || []).map((p) => [p.id, p]));

  const paidPriceMap = new Map<string, number[]>();
  for (const pay of (robotPayments || []) as { cart_snapshot: Json | undefined; amount: number; user_id: string }[]) {
    const snapshot = paymentCartSnapshot(pay.cart_snapshot);
    if (snapshot.length === 0) continue;

    const cartTotal = snapshot.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const actualPaid = pay.amount / 100;

    for (const item of snapshot) {
      const key = `${pay.user_id}|${item.productId}|${item.planId}`;
      if (item.price != null) {
        const proportion = cartTotal > 0 ? Number(item.price) / cartTotal : 0;
        const arr = paidPriceMap.get(key) || [];
        arr.push(actualPaid * proportion);
        paidPriceMap.set(key, arr);
      }
    }
  }

  return tickets.map((t) => {
    const product = productMap[t.product_id];
    const plan = planMap[t.product_plan_id];
    const meta = asOrderTicketMetadata(t.metadata);

    const key = `${t.user_id}|${t.product_id}|${t.product_plan_id}`;
    const revenue = paidPriceMap.get(key)?.shift() ?? 0;

    let cost = 0;
    if (meta.amount_spent && Number(meta.amount_spent) > 0) {
      cost = Number(meta.amount_spent) * 0.6 * rate;
    } else if (meta.is_free) {
      cost = 0;
    } else if (product?.robot_markup_percent) {
      cost = revenue / (1 + (product.robot_markup_percent || 50) / 100);
    }

    return {
      id: t.id,
      created_at: t.created_at || "",
      product_name: product?.name || "Desconhecido",
      plan_name: plan?.name || "—",
      revenue,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      status: t.status || "unknown",
      duration: plan?.robot_duration_days || meta.duration || null,
    };
  });
}

export async function fetchAdminRobotProjectBundle(period: RobotProjectSalesPeriod): Promise<AdminRobotProjectBundle> {
  const ratePromise = getUsdToBrl(5.16).catch((err) => {
    console.warn("getUsdToBrl failed in Robot admin bundle, using fallback 5.16", err);
    return 5.16;
  });
  const session = (await supabase.auth.getSession()).data?.session;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session?.access_token ?? ""}`,
    apikey: supabaseAnonKey,
  };

  const edgePromise = (async (): Promise<{ pingOnline: boolean; robotGames: RobotGame[] }> => {
    try {
      const [pingRes, gamesRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/robot-project?action=ping`, { headers }),
        fetch(`${supabaseUrl}/functions/v1/robot-project?action=list-games`, { headers }),
      ]);
      let robotGames: RobotGame[] = [];
      if (gamesRes.ok) {
        const data = await gamesRes.json();
        robotGames = Array.isArray(data) ? data : data.games || [];
      }
      return { pingOnline: pingRes.ok, robotGames };
    } catch {
      return { pingOnline: false, robotGames: [] };
    }
  })();

  const productsPromise = fetchProductsWithRobot();
  const pendingPromise = fetchPendingRobotTickets();
  const rate = await ratePromise;

  const [{ pingOnline, robotGames }, productsWithRobot, pendingRobotTickets] = await Promise.all([
    edgePromise,
    productsPromise,
    pendingPromise,
  ]);

  let robotSales: RobotSale[] = [];
  try {
    robotSales = await fetchRobotSalesForPeriod(period, rate);
  } catch (err) {
    console.error("fetchRobotSalesForPeriod error:", err);
    robotSales = [];
  }

  const freeGamesCount = robotGames.filter((g) => g.is_free === true || g.isFree === true).length;

  return {
    pingOnline,
    robotGames,
    freeGamesCount,
    usdToBrl: rate,
    productsWithRobot,
    robotSales,
    pendingRobotTickets,
  };
}
