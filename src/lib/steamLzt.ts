/**
 * Normaliza dados de biblioteca Steam vindos da API LZT (formatos variam por conta).
 */

export type SteamLibGame = {
  appid?: number;
  name?: string;
  /** Minutos jogados (convenção Steam: playtime_forever) */
  playtimeMinutes?: number;
};

function tryJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function playtimeToMinutes(raw: Record<string, unknown>): number | undefined {
  const pf = raw.playtime_forever ?? raw.playtime;
  if (typeof pf === "number" && pf > 0) return Math.round(pf);
  const hours = raw.hours;
  if (typeof hours === "number" && hours > 0) {
    if (hours > 500) return Math.round(hours);
    return Math.round(hours * 60);
  }
  return undefined;
}

function entryToGame(entry: unknown): SteamLibGame | null {
  if (typeof entry === "string") {
    const t = entry.trim();
    return t ? { name: t } : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const o = entry as Record<string, unknown>;
  const appidRaw = o.appid ?? o.app_id ?? o.id;
  const appid = typeof appidRaw === "number" ? appidRaw : Number(appidRaw);
  const name = String(o.name ?? o.title ?? o.gameName ?? "").trim();
  const pt = playtimeToMinutes(o);
  const g: SteamLibGame = {
    appid: Number.isFinite(appid) && appid > 0 ? appid : undefined,
    name: name || undefined,
    playtimeMinutes: pt,
  };
  return g.name || g.appid ? g : null;
}

export function normalizeSteamGamesFromRaw(raw: Record<string, unknown> | undefined | null): SteamLibGame[] {
  if (!raw) return [];

  const candidates: unknown[] = [
    tryJsonParse(raw.steamGames),
    tryJsonParse(raw.steam_games_list),
    tryJsonParse(raw.steam_games),
    tryJsonParse(raw.games),
    raw.steamGames,
    raw.steam_games_list,
    raw.steam_games,
    raw.games,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      const out: SteamLibGame[] = [];
      for (const entry of c) {
        const g = entryToGame(entry);
        if (g) out.push(g);
      }
      if (out.length) return out;
    } else if (typeof c === "object") {
      const out: SteamLibGame[] = [];
      for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
        if (v && typeof v === "object") {
          const o = { ...(v as Record<string, unknown>), appid: (v as Record<string, unknown>).appid ?? Number(k) };
          const g = entryToGame(o);
          if (g) out.push(g);
        } else if (typeof v === "string" && v.trim()) {
          const id = Number(k);
          out.push({ appid: Number.isFinite(id) && id > 0 ? id : undefined, name: v.trim() });
        }
      }
      if (out.length) return out;
    }
  }
  return [];
}

export function countSteamGamesOnListItem(item: Record<string, unknown>): number {
  const n = Number(item.steam_games_count ?? item.games_count ?? item.total_games);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 99999);
  return normalizeSteamGamesFromRaw(item).length;
}

/** URLs que claramente vêm da Steam — o campo LZT `weapons` às vezes é collage de outro jogo; só aceitamos weapons se for isso. */
export function isLikelySteamHostedImageUrl(url: string): boolean {
  const u = String(url || "").toLowerCase();
  if (!u.startsWith("http")) return false;
  return (
    u.includes("steamstatic.com") ||
    u.includes("akamaihd.net") ||
    u.includes("steamcommunity.com") ||
    u.includes("cloudflare.steamstatic.com")
  );
}

export function steamLibraryHeaderImageUrl(appid: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

type PreviewDirect = { weapons?: string; main?: string };

/**
 * Hero/listagem Steam: `main` do LZT primeiro; senão capa do 1º jogo da biblioteca (CDN Steam);
 * `weapons` só se a URL for claramente hospedada na Steam (evita collage Valorant/CS errado).
 */
export function resolveSteamHeroImage(item: Record<string, unknown>): string | null {
  const direct = (item.imagePreviewLinks as { direct?: PreviewDirect } | undefined)?.direct;
  const main = direct?.main?.trim();
  if (main) return main;

  const games = normalizeSteamGamesFromRaw(item);
  const firstAppid = games.find((g) => g.appid != null && g.appid > 0)?.appid;
  if (firstAppid != null) return steamLibraryHeaderImageUrl(firstAppid);

  const weapons = direct?.weapons?.trim();
  if (weapons && isLikelySteamHostedImageUrl(weapons)) return weapons;

  return null;
}

export function formatSteamPlaytime(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h >= 1) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}
