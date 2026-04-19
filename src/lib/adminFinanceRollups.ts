import { supabase } from "@/integrations/supabase/client";
import { devWarnAdminRpc, isAdminRpcPostgrestFallbackError } from "@/lib/adminFinancePostgrest";
import { isRecord } from "@/types/ticketChat";

export interface AdminFinancePaymentRollupSlice {
  revenue_cents: number;
  count: number;
  buyers: number;
  paid_count: number;
}

export interface AdminFinanceLztRollupSlice {
  buy: number;
  sell: number;
  profit: number;
  count: number;
}

export interface AdminFinanceResellerRollupSlice {
  discount: number;
  count: number;
}

export interface AdminFinanceRobotRollupSlice {
  revenue: number;
  cost: number;
  profit: number;
  lines: number;
}

export interface AdminFinanceRollups {
  payments: Partial<Record<string, AdminFinancePaymentRollupSlice>>;
  lzt: Partial<Record<string, AdminFinanceLztRollupSlice>>;
  reseller: Partial<Record<string, AdminFinanceResellerRollupSlice>>;
  robot?: Partial<Record<string, AdminFinanceRobotRollupSlice>>;
}

function parsePaymentSlice(v: unknown): AdminFinancePaymentRollupSlice | null {
  if (!isRecord(v)) return null;
  return {
    revenue_cents: Number(v.revenue_cents ?? 0),
    count: Number(v.count ?? 0),
    buyers: Number(v.buyers ?? 0),
    paid_count: Number(v.paid_count ?? 0),
  };
}

function parseLztSlice(v: unknown): AdminFinanceLztRollupSlice | null {
  if (!isRecord(v)) return null;
  return {
    buy: Number(v.buy ?? 0),
    sell: Number(v.sell ?? 0),
    profit: Number(v.profit ?? 0),
    count: Number(v.count ?? 0),
  };
}

function parseResellerSlice(v: unknown): AdminFinanceResellerRollupSlice | null {
  if (!isRecord(v)) return null;
  return {
    discount: Number(v.discount ?? 0),
    count: Number(v.count ?? 0),
  };
}

function parseRobotSlice(v: unknown): AdminFinanceRobotRollupSlice | null {
  if (!isRecord(v)) return null;
  return {
    revenue: Number(v.revenue ?? 0),
    cost: Number(v.cost ?? 0),
    profit: Number(v.profit ?? 0),
    lines: Number(v.lines ?? 0),
  };
}

function parseRollupGroup<T>(
  raw: unknown,
  parse: (v: unknown) => T | null
): Partial<Record<string, T>> {
  if (!isRecord(raw)) return {};
  const out: Partial<Record<string, T>> = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = parse(v);
    if (p != null) out[k] = p;
  }
  return out;
}

function parseAdminFinanceRollups(data: unknown): AdminFinanceRollups | null {
  if (!isRecord(data)) return null;
  return {
    payments: parseRollupGroup(data.payments, parsePaymentSlice),
    lzt: parseRollupGroup(data.lzt, parseLztSlice),
    reseller: parseRollupGroup(data.reseller, parseResellerSlice),
  };
}

/** Agregados por período no Postgres (totais correctos). Robot usa 2ª RPC opcional. Devolve null se a RPC principal falhar de forma recuperável. */
export async function fetchAdminFinancePeriodRollups(): Promise<AdminFinanceRollups | null> {
  const [{ data, error }, robotRpc] = await Promise.all([
    supabase.rpc("admin_finance_period_rollups"),
    supabase.rpc("admin_finance_robot_rollups"),
  ]);
  if (error) {
    if (isAdminRpcPostgrestFallbackError(error)) {
      devWarnAdminRpc("rollups", "admin_finance_period_rollups", "omitir agregados (fallback)", error);
      return null;
    }
    throw error;
  }
  const base = parseAdminFinanceRollups(data);
  if (!base) return null;

  if (!robotRpc.error && robotRpc.data != null) {
    const robot = parseRollupGroup(robotRpc.data, parseRobotSlice);
    if (Object.keys(robot).length > 0) base.robot = robot;
  } else if (robotRpc.error) {
    devWarnAdminRpc("rollups", "admin_finance_robot_rollups", "robot omitido", robotRpc.error);
  }
  return base;
}

type AdminFinanceRollupPeriod = "24h" | "7d" | "30d" | "all";

export function rollupPayment(
  rollups: AdminFinanceRollups | null | undefined,
  period: AdminFinanceRollupPeriod,
  prev: boolean,
): AdminFinancePaymentRollupSlice | null {
  if (!rollups?.payments) return null;
  if (period === "all") return prev ? null : rollups.payments.all ?? null;
  const key = prev ? `${period}_prev` : period;
  return rollups.payments[key] ?? null;
}

export function rollupLzt(
  rollups: AdminFinanceRollups | null | undefined,
  period: AdminFinanceRollupPeriod,
  prev: boolean,
): AdminFinanceLztRollupSlice | null {
  if (!rollups?.lzt) return null;
  if (period === "all") return prev ? null : rollups.lzt.all ?? null;
  const key = prev ? `${period}_prev` : period;
  return rollups.lzt[key] ?? null;
}

export function rollupReseller(
  rollups: AdminFinanceRollups | null | undefined,
  period: AdminFinanceRollupPeriod,
  prev: boolean,
): AdminFinanceResellerRollupSlice | null {
  if (!rollups?.reseller) return null;
  if (period === "all") return prev ? null : rollups.reseller.all ?? null;
  const key = prev ? `${period}_prev` : period;
  return rollups.reseller[key] ?? null;
}

export function rollupRobot(
  rollups: AdminFinanceRollups | null | undefined,
  period: AdminFinanceRollupPeriod,
  prev: boolean,
): AdminFinanceRobotRollupSlice | null {
  if (!rollups?.robot) return null;
  if (period === "all") return prev ? null : rollups.robot.all ?? null;
  const key = prev ? `${period}_prev` : period;
  return rollups.robot[key] ?? null;
}
