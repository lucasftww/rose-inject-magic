import { GAME_SLUG_ALIASES } from "../../supabase/functions/_shared/gameSlugAliases.ts";

export function normalizeGameSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const aliasHit = GAME_SLUG_ALIASES[normalized];
  if (aliasHit) return aliasHit;

  const slug = normalized
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) return null;
  /** Slug derivado de títulos longos ("League of Legends" → league-of-legends) — alinhar às regras Meta (`lol`, …). */
  const slugAlias = GAME_SLUG_ALIASES[slug];
  if (slugAlias) return slugAlias;
  return slug;
}
