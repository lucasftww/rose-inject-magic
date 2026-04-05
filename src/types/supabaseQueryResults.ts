import type { Tables } from "@/integrations/supabase/types";

export type ProductRow = Tables<"products">;
export type ProductPlanRow = Tables<"product_plans">;
export type ProductMediaRow = Tables<"product_media">;
export type ProductFeatureRow = Tables<"product_features">;

/** `products` + `product_plans(*)` (admin list). */
export type AdminProductWithPlansRow = ProductRow & {
  product_plans: ProductPlanRow[] | null;
};

/** Linha única de produto público com relações aninhadas. */
export type ProductDetailQueryRow = ProductRow & {
  product_plans: ProductPlanRow[] | null;
  product_media: ProductMediaRow[] | null;
  product_features: ProductFeatureRow[] | null;
};

/** UI da página de produto (tipos estreitos, sem nullables desnecessários nas listas). */
export type StoreProductDetail = {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  features_text: string | null;
  image_url: string | null;
  active: boolean;
  robot_game_id: number | null;
  product_plans: {
    id: string;
    name: string;
    price: number;
    active: boolean;
    sort_order: number;
  }[];
  product_media: {
    id: string;
    media_type: "image" | "video";
    url: string;
    sort_order: number;
  }[];
  product_features: {
    id: string;
    label: string;
    value: string;
    sort_order: number;
  }[];
};

export function narrowMediaType(raw: string): "image" | "video" {
  return raw === "video" ? "video" : "image";
}

/** Converte resposta do Supabase na forma usada por `ProdutoDetalhes`. */
export function mapProductDetailQueryRow(row: ProductDetailQueryRow): StoreProductDetail {
  return {
    id: row.id,
    game_id: row.game_id ?? "",
    name: row.name,
    description: row.description,
    features_text: row.features_text,
    image_url: row.image_url,
    active: row.active ?? false,
    robot_game_id: row.robot_game_id,
    product_plans: (row.product_plans ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      active: p.active ?? false,
      sort_order: p.sort_order ?? 0,
    })),
    product_media: (row.product_media ?? []).map((m) => ({
      id: m.id,
      media_type: narrowMediaType(m.media_type),
      url: m.url,
      sort_order: m.sort_order ?? 0,
    })),
    product_features: (row.product_features ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
      sort_order: f.sort_order ?? 0,
    })),
  };
}

/** Produto + join `games(name)` (aba Status). */
export type ProductStatusQueryRow = Pick<
  ProductRow,
  "id" | "name" | "image_url" | "status" | "status_label"
> & {
  games: { name: string | null } | null;
};

export type ProductStatusListItem = {
  id: string;
  name: string;
  image_url: string | null;
  status: string | null;
  status_label: string | null;
  game_name: string;
};

export function mapProductStatusRow(row: ProductStatusQueryRow): ProductStatusListItem {
  return {
    id: row.id,
    name: row.name,
    image_url: row.image_url,
    status: row.status,
    status_label: row.status_label,
    game_name: row.games?.name ?? "",
  };
}

// ─── Runtime validation (evita `as` nas páginas; cast só após checagem) ───

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/** Estrutura mínima que `mapProductDetailQueryRow` precisa (resposta `maybeSingle` + nested *). */
function isValidProductDetailPayload(data: unknown): boolean {
  if (!isRecord(data)) return false;
  if (typeof data.id !== "string" || typeof data.name !== "string") return false;

  const checkPlans = (v: unknown): boolean => {
    if (v == null) return true;
    if (!Array.isArray(v)) return false;
    return v.every(
      (p) =>
        isRecord(p) && typeof p.id === "string" && typeof p.name === "string",
    );
  };
  const checkMedia = (v: unknown): boolean => {
    if (v == null) return true;
    if (!Array.isArray(v)) return false;
    return v.every(
      (m) =>
        isRecord(m) &&
        typeof m.id === "string" &&
        typeof m.media_type === "string" &&
        typeof m.url === "string",
    );
  };
  const checkFeatures = (v: unknown): boolean => {
    if (v == null) return true;
    if (!Array.isArray(v)) return false;
    return v.every(
      (f) =>
        isRecord(f) &&
        typeof f.id === "string" &&
        typeof f.label === "string" &&
        typeof f.value === "string",
    );
  };

  return (
    checkPlans(data.product_plans) &&
    checkMedia(data.product_media) &&
    checkFeatures(data.product_features)
  );
}

/** Produto público: `null` se o JSON não bater com o esperado. */
export function parseStoreProductDetail(data: unknown): StoreProductDetail | null {
  if (!isValidProductDetailPayload(data)) return null;
  return mapProductDetailQueryRow(data as ProductDetailQueryRow);
}

export function isValidProductStatusPayload(data: unknown): boolean {
  if (!isRecord(data)) return false;
  if (typeof data.id !== "string" || typeof data.name !== "string") return false;
  const g = data.games;
  if (g != null && !isRecord(g)) return false;
  return true;
}

/** Lista status + jogo; ignora linhas inválidas. */
export function mapProductStatusRows(data: unknown): ProductStatusListItem[] {
  if (!Array.isArray(data)) return [];
  const out: ProductStatusListItem[] = [];
  for (const row of data) {
    if (!isValidProductStatusPayload(row)) continue;
    out.push(mapProductStatusRow(row as ProductStatusQueryRow));
  }
  return out;
}

export function isValidAdminProductWithPlansRow(data: unknown): boolean {
  if (!isRecord(data)) return false;
  if (typeof data.id !== "string" || typeof data.name !== "string") return false;
  const plans = data.product_plans;
  if (plans == null) return true;
  if (!Array.isArray(plans)) return false;
  return plans.every((p) => isRecord(p) && typeof (p as Record<string, unknown>).id === "string");
}

export function parseAdminProductsWithPlans(data: unknown): AdminProductWithPlansRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isValidAdminProductWithPlansRow) as AdminProductWithPlansRow[];
}
