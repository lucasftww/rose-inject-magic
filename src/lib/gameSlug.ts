const GAME_SLUG_ALIASES: Record<string, string> = {
  "counter strike 2": "cs2",
  "counter-strike 2": "cs2",
  "counter-strike-2": "cs2",
  cs2: "cs2",
  "call of duty": "cod",
  "call-of-duty": "cod",
  cod: "cod",
  "arena breakout infinite": "arena-breakout-infinite",
  "arena-breakout-infinite": "arena-breakout-infinite",
  "arc raiders": "arc-raiders",
  "arc-raiders": "arc-raiders",
  "apex legends": "apex-legends",
  "apex-legends": "apex-legends",
  "overwatch 2": "overwatch-2",
  "overwatch-2": "overwatch-2",
  "marvel rivals": "marvel-rivals",
  "marvel-rivals": "marvel-rivals",
  "dead by daylight": "dead-by-daylight",
  "dead-by-daylight": "dead-by-daylight",
  "hell let loose": "hell-let-loose",
  "hell-let-loose": "hell-let-loose",
  fivem: "fivem",
  dayz: "dayz",
  rust: "rust",
  valorant: "valorant",
  fortnite: "fortnite",
  minecraft: "minecraft",
  lol: "lol",
  produto: "produto",
  multi: "multi",
};

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

  return slug || null;
}
