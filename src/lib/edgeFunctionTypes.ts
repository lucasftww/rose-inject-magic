/**
 * JSON shapes returned by `pix-payment` and related Edge Function calls
 * (used with safeJsonFetch<T>).
 */

export interface PixPaymentCharge {
  brCode: string;
  qrCodeImage: string;
  expiresAt: string;
}

export interface PixPaymentCrypto {
  address: string;
  qrCode: string;
  payAmount: number;
  payCurrency: string;
  network: string;
  expiresAt: string;
}

export interface PixPaymentCreateResult {
  success: boolean;
  error?: string;
  payment_id?: string;
  validated_amount?: number;
  validated_discount?: number;
  charge?: PixPaymentCharge;
  paymentUrl?: string;
  crypto?: PixPaymentCrypto;
}

export interface PixPaymentStatusResult {
  success?: boolean;
  error?: string;
  status?: string;
}

export type PixPaymentVerifyResult = PixPaymentStatusResult;

/** scratch-card-play POST response */
export interface ScratchCardGridCell {
  type: "prize" | "nothing";
  prizeId?: string;
  name: string;
  image_url?: string | null;
  nothingIcon: "x" | "flower" | "skull";
  prize_value?: number;
}

export interface ScratchCardPlayResult {
  grid: ScratchCardGridCell[];
  won: boolean;
  prize?: {
    id?: string;
    name?: string;
    image_url?: string | null;
    prize_value?: number;
  } | null;
}

/** DDragon */
export type DDragonVersionList = string[];

export interface DDragonChampionJson {
  data: Record<string, { key: string; id?: string; name?: string }>;
}

/** Fortnite API (partial — `data` may be array or wrapped) */
export interface FortniteCosmeticItem {
  id?: string;
  name?: string;
  images?: { smallIcon?: string; icon?: string };
}

export interface FortniteCosmeticsResponse {
  data?: FortniteCosmeticItem[] | { items?: FortniteCosmeticItem[] };
}

/** lzt-market `action=detail` (LoL page uses subset of fields) */
export interface LztMarketLolDetailResponse {
  item?: {
    item_id?: string | number;
    title?: string;
    description?: string | null;
    price?: number;
    price_currency?: string;
    lolInventory?: unknown;
    riot_lol_rank?: string;
    riot_lol_level?: number;
    riot_lol_champion_count?: number;
    riot_lol_skin_count?: number;
    riot_lol_rank_win_rate?: number;
    riot_lol_wallet_blue?: number;
    riot_lol_wallet_orange?: number;
    riot_lol_region?: string;
  };
}
