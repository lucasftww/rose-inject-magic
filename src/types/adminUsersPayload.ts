/** Resposta tipada da Edge Function `admin-users` (lista utilizadores). */

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export interface RecentPayment {
  amount: number;
  status: string;
  created_at: string;
  cart_snapshot: { productName?: string; planName?: string; quantity?: number }[];
}

export interface UserOrder {
  id: string;
  product_name: string;
  product_image: string | null;
  plan_name: string;
  plan_price: number;
  status: string;
  status_label: string;
  created_at: string;
  stock_content: string | null;
}

export interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  username: string | null;
  avatar_url: string | null;
  banned: boolean;
  banned_at: string | null;
  banned_reason: string | null;
  roles: string[];
  provider: string;
  login_ips: { ip_address: string; logged_at: string }[];
  total_spent: number;
  total_orders: number;
  recent_payments: RecentPayment[];
  orders: UserOrder[];
}

function parseStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string");
}

function parseLoginIps(x: unknown): { ip_address: string; logged_at: string }[] {
  if (!Array.isArray(x)) return [];
  const out: { ip_address: string; logged_at: string }[] = [];
  for (const el of x) {
    if (!isRecord(el)) continue;
    if (typeof el.ip_address !== "string" || typeof el.logged_at !== "string") continue;
    out.push({ ip_address: el.ip_address, logged_at: el.logged_at });
  }
  return out;
}

function parseCartSnapshotLine(x: unknown): { productName?: string; planName?: string; quantity?: number } | null {
  if (!isRecord(x)) return null;
  const line: { productName?: string; planName?: string; quantity?: number } = {};
  if (typeof x.productName === "string") line.productName = x.productName;
  if (typeof x.planName === "string") line.planName = x.planName;
  if (typeof x.quantity === "number" && Number.isFinite(x.quantity)) line.quantity = x.quantity;
  return line;
}

function parseRecentPayment(x: unknown): RecentPayment | null {
  if (!isRecord(x)) return null;
  if (typeof x.status !== "string" || typeof x.created_at !== "string") return null;
  const amount = Number(x.amount);
  if (!Number.isFinite(amount)) return null;
  const rawSnap = x.cart_snapshot;
  const cart_snapshot: RecentPayment["cart_snapshot"] = [];
  if (Array.isArray(rawSnap)) {
    for (const line of rawSnap) {
      const l = parseCartSnapshotLine(line);
      if (l) cart_snapshot.push(l);
    }
  }
  return { amount, status: x.status, created_at: x.created_at, cart_snapshot };
}

function parseUserOrder(x: unknown): UserOrder | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== "string" || typeof x.product_name !== "string") return null;
  if (typeof x.plan_name !== "string" || typeof x.status !== "string" || typeof x.status_label !== "string") return null;
  if (typeof x.created_at !== "string") return null;
  const plan_price = Number(x.plan_price);
  if (!Number.isFinite(plan_price)) return null;
  const img = x.product_image;
  const product_image = img === null || typeof img === "string" ? (img as string | null) : null;
  const stock = x.stock_content;
  const stock_content = stock === null || typeof stock === "string" ? (stock as string | null) : null;
  return {
    id: x.id,
    product_name: x.product_name,
    product_image,
    plan_name: x.plan_name,
    plan_price,
    status: x.status,
    status_label: x.status_label,
    created_at: x.created_at,
    stock_content,
  };
}

/** Normaliza a resposta JSON da função (ignora entradas inválidas). */
export function parseAdminUsersResponse(data: unknown): UserData[] {
  if (!Array.isArray(data)) return [];
  const out: UserData[] = [];
  for (const el of data) {
    if (!isRecord(el)) continue;
    if (typeof el.id !== "string" || typeof el.email !== "string") continue;
    const ordersRaw = el.orders;
    const orders: UserOrder[] = Array.isArray(ordersRaw)
      ? ordersRaw.map(parseUserOrder).filter((o): o is UserOrder => o != null)
      : [];
    const payRaw = el.recent_payments;
    const recent_payments: RecentPayment[] = Array.isArray(payRaw)
      ? payRaw.map(parseRecentPayment).filter((p): p is RecentPayment => p != null)
      : [];
    out.push({
      id: el.id,
      email: el.email,
      created_at: typeof el.created_at === "string" ? el.created_at : "",
      last_sign_in_at: el.last_sign_in_at === null || typeof el.last_sign_in_at === "string" ? el.last_sign_in_at : null,
      email_confirmed_at:
        el.email_confirmed_at === null || typeof el.email_confirmed_at === "string" ? el.email_confirmed_at : null,
      username: el.username === null || typeof el.username === "string" ? el.username : null,
      avatar_url: el.avatar_url === null || typeof el.avatar_url === "string" ? el.avatar_url : null,
      banned: Boolean(el.banned),
      banned_at: el.banned_at === null || typeof el.banned_at === "string" ? el.banned_at : null,
      banned_reason: el.banned_reason === null || typeof el.banned_reason === "string" ? el.banned_reason : null,
      roles: parseStringArray(el.roles),
      provider: typeof el.provider === "string" ? el.provider : "",
      login_ips: parseLoginIps(el.login_ips),
      total_spent: Number.isFinite(Number(el.total_spent)) ? Number(el.total_spent) : 0,
      total_orders: Number.isFinite(Number(el.total_orders)) ? Number(el.total_orders) : 0,
      recent_payments,
      orders,
    });
  }
  return out;
}
