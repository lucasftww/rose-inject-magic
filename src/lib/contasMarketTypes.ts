export type GameTab =
  | "valorant"
  | "lol"
  | "fortnite"
  | "minecraft"
  | "genshin"
  | "honkai"
  | "zzz"
  | "brawlstars";

export interface LztItem {
  item_id: number;
  title: string;
  title_en?: string;
  description?: string;
  price: number;
  rub_price?: number;
  price_currency?: string;
  // Valorant
  riot_valorant_rank?: number;
  riot_valorant_skin_count?: number;
  riot_valorant_agent_count?: number;
  riot_valorant_level?: number;
  riot_valorant_knife?: number;
  riot_valorant_region?: string;
  riot_valorant_inventory_value?: number;
  riot_valorant_wallet_vp?: number;
  riot_valorant_rank_type?: string;
  // LoL
  riot_lol_rank?: string;
  riot_lol_level?: number;
  riot_lol_skin_count?: number;
  riot_lol_champion_count?: number;
  riot_lol_region?: string;
  riot_lol_wallet_blue?: number;
  riot_lol_wallet_orange?: number;
  riot_lol_rank_win_rate?: number;
  // Minecraft
  minecraft_nickname?: string;
  minecraft_java?: number;
  minecraft_bedrock?: number;
  minecraft_hypixel_rank?: string;
  minecraft_hypixel_level?: number;
  minecraft_capes_count?: number;
  minecraft_hypixel_ban?: number;
  minecraft_dungeons?: number;
  minecraft_legends?: number;
  // Common
  riot_username?: string;
  riot_country?: string;
  email_type?: string;
  valorantRankTitle?: string;
  valorantRankImgPath?: string;
  valorantRegionPhrase?: string;
  item_origin?: string;
  published_date?: number;
  view_count?: number;
  // Fortnite
  fortnite_balance?: number;
  fortnite_vbucks?: number;
  fortnite_level?: number;
  fortnite_skin_count?: number;
  fortnite_outfit_count?: number;
  fortniteSkins?: Array<{ id: string; title?: string }>;
  fortnitePickaxe?: Array<{ id: string; title?: string }>;
  fortnitePastSeasons?: Array<{ purchasedVIP?: boolean; seasonNumber?: number }>;
  lolInventory?: {
    Champion?: number[];
    Skin?: number[] | Record<string, number>;
  } | null;
  valorantInventory?: {
    WeaponSkins?: string[];
    Agent?: string[];
    Buddy?: string[];
    Champion?: string[];
    Skin?: string[];
  };
  imagePreviewLinks?: {
    direct?: { weapons?: string; agents?: string; buddies?: string; main?: string };
  };
  // Server-calculated BRL price (with correct markup)
  price_brl?: number;
}

export type LztMarketListResponse = {
  items?: LztItem[];
  hasNextPage?: boolean;
  page?: number;
  perPage?: number;
  totalItems?: number;
  /** True when LZT API is in maintenance — frontend should show friendly message */
  fallback?: boolean;
  error?: string;
};

export function gameTabFromSearchParams(sp: URLSearchParams): GameTab {
  const g = sp.get("game");
  if (g === "lol") return "lol";
  if (g === "fortnite") return "fortnite";
  if (g === "minecraft") return "minecraft";
  if (g === "genshin") return "genshin";
  if (g === "honkai") return "honkai";
  if (g === "zzz") return "zzz";
  if (g === "brawlstars") return "genshin";
  return "valorant";
}
