/** Campos extras do item LZT (API detail) — Fortnite */
export interface LztFortniteCosmeticEntry {
  id: string;
  title?: string;
  rarity?: string;
  type?: string;
  from_shop?: number;
  shop_price?: number;
}

export interface LztFortniteItemExtras {
  fortniteSkins?: LztFortniteCosmeticEntry[];
  fortnitePickaxe?: LztFortniteCosmeticEntry[];
  fortniteDance?: LztFortniteCosmeticEntry[];
  fortniteGliders?: LztFortniteCosmeticEntry[];
  fortnite_balance?: number;
  fortnite_vbucks?: number;
  fortnite_skin_count?: number;
  fortnite_outfit_count?: number;
  fortnite_level?: number;
}

/** Campos extras do item LZT (API detail) — Minecraft */
export type LztMinecraftCapeEntry = string | { name?: string; rendered?: string };

export interface LztMinecraftItemExtras {
  minecraft_nickname?: string;
  minecraft_java?: number;
  minecraft_bedrock?: number;
  minecraft_hypixel_rank?: string;
  minecraft_hypixel_level?: number;
  minecraft_hypixel_achievement?: number;
  minecraft_capes_count?: number;
  minecraft_capes?: LztMinecraftCapeEntry[];
  minecraft_hypixel_ban?: number;
  minecraft_hypixel_ban_reason?: string;
  minecraft_dungeons?: number;
  minecraft_legends?: number;
  minecraft_minecoins?: number;
  minecraft_hypixel_skyblock_level?: number;
}
