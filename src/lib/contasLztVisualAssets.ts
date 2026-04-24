/** Miniaturas para cards LZT (miHoYo / Supercell) — extrai URLs de imagem do JSON do item. */

const IMG_URL_RE = /^https?:\/\/[^\s"'<>]+\.(png|jpe?g|webp)(\?[^\s"'<>]*)?$/i;

function looksLikeTrustedGameImageUrl(t: string): boolean {
  const lower = t.toLowerCase();
  return (
    lower.includes("lzt.market") ||
    lower.includes("hoyoverse") ||
    lower.includes("webstatic") ||
    lower.includes("mihoyo") ||
    lower.includes("hoyolab") ||
    lower.includes("brawlify") ||
    lower.includes("supercell") ||
    lower.includes("akamai") ||
    lower.includes("genshinimpact") ||
    lower.includes("starrail") ||
    lower.includes("zenless")
  );
}

function collectImageStrings(obj: unknown, out: Set<string>, depth: number, limit: number) {
  if (out.size >= limit || depth > 14) return;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (t.length > 12 && IMG_URL_RE.test(t) && looksLikeTrustedGameImageUrl(t)) {
      out.add(t);
    }
    return;
  }
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const el of obj) {
      collectImageStrings(el, out, depth + 1, limit);
      if (out.size >= limit) return;
    }
    return;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    collectImageStrings(v, out, depth + 1, limit);
    if (out.size >= limit) return;
  }
}

export function extractLztItemImageUrls(item: unknown, limit = 12): string[] {
  const out = new Set<string>();
  collectImageStrings(item, out, 0, limit);
  return [...out];
}

export type MihoyoCardVariant = "genshin" | "honkai" | "zzz";

/** Prioriza URLs cujo path/query sugere o jogo (quando o item mistura vários). */
export function extractMihoyoCardPreviews(item: unknown, variant: MihoyoCardVariant): string[] {
  const all = extractLztItemImageUrls(item, 20);
  const needle =
    variant === "genshin" ? "genshin" : variant === "honkai" ? "honkai" : "zenless";
  const hinted = all.filter((u) => u.toLowerCase().includes(needle));
  const pool = hinted.length >= 2 ? hinted : all;
  return pool.slice(0, 8);
}

function brawlifySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Nomes de brawlers a partir de campos comuns da resposta LZT Supercell. */
export function extractBrawlBrawlerNames(item: Record<string, unknown>): string[] {
  const names: string[] = [];

  const pushFromArray = (c: unknown) => {
    if (!c || !Array.isArray(c)) return;
    for (const el of c) {
      if (typeof el === "string" && el.trim()) names.push(el.trim());
      else if (el && typeof el === "object") {
        const o = el as Record<string, unknown>;
        const n = o.name ?? o.title ?? o.id;
        if (typeof n === "string" && n.trim()) names.push(n.trim());
      }
    }
  };

  /** Lista LZT às vezes manda `supercell_brawlers` como mapa (contagem no pricing model). */
  const sb = item.supercell_brawlers;
  if (sb && typeof sb === "object" && !Array.isArray(sb)) {
    for (const [k, v] of Object.entries(sb as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) {
        names.push(v.trim());
      } else if (v === true || v === 1 || v === "1") {
        const key = k.trim();
        if (key && /[A-Za-zÀ-ÿ]/.test(key)) names.push(key);
      }
    }
  }

  const candidates = [
    item.brawl_brawlers,
    item.brawlers,
    item.brawler,
    item.supercell_brawlers,
    item.brawler_list,
  ];
  for (const c of candidates) {
    pushFromArray(c);
    if (names.length >= 8) break;
  }
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const n of names) {
    const k = n.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
    if (uniq.length >= 8) break;
  }
  return uniq;
}

/** Avatar público Brawlify (fallback quando o JSON LZT não traz URL). */
export function brawlifyAvatarUrl(brawlerName: string): string {
  const slug = brawlifySlug(brawlerName);
  if (!slug) return "";
  return `https://cdn-old.brawlify.com/brawlers/${encodeURIComponent(slug)}/avatar.png`;
}
