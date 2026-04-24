import { rankMap } from "@/lib/valorantData";

export type LztGameKind =
  | "valorant"
  | "lol"
  | "fortnite"
  | "minecraft"
  | "brawlstars"
  | "genshin"
  | "honkai"
  | "zzz";

/** Campos mínimos dos itens LZT para montar título de card / detalhe */
type LztItemForTitle = {
  title?: string;
  riot_valorant_rank?: number;
  riot_valorant_skin_count?: number;
  riot_lol_rank?: string;
  riot_lol_level?: number;
  riot_lol_skin_count?: number;
  fortnite_skin_count?: number;
  fortnite_outfit_count?: number;
  fortnite_balance?: number;
  fortnite_vbucks?: number;
  fortnite_level?: number;
  minecraft_nickname?: string;
  minecraft_java?: number;
  minecraft_bedrock?: number;
  brawlers_count?: number;
  brawl_cups?: number;
  brawl_level?: number;
  genshin_char_count?: number;
  genshin_legendary_count?: number;
  honkai_char_count?: number;
  honkai_eidolon_count?: number;
  zenless_char_count?: number;
  zenless_legendary_count?: number;
};

function stripCyrillic(raw: string | undefined): string {
  return (raw || "").replace(/[А-Яа-я]/g, "").trim();
}

/** Padrões típicos de título colado pelo LZT / vendedores */
export function looksLikeLztMarketDumpTitle(t: string, game: LztGameKind): boolean {
  const lower = t.toLowerCase();
  if (/\blast\s+match\b/i.test(lower)) return true;
  if (/\bdays?\s+ago\b/i.test(lower)) return true;
  if (/\(\s*\d+\s*days?\s*ago\s*\)/i.test(t)) return true;
  const pipeCount = (t.match(/\|/g) || []).length;
  if (pipeCount >= 2) return true;
  if (pipeCount >= 1 && /skins?\s*\|/i.test(t)) return true;
  if (game === "fortnite" || game === "valorant") {
    if (/^\d+\s*skins?\s*\|/i.test(t.trim())) return true;
    if (/\|\s*[^|]{3,}\s*\+\s*[^|]{3,}\s*\|/.test(t)) return true;
  }
  return false;
}

/** Quando o título cru do LZT não deve ser exibido (listagem ou detalhe). */
export function shouldReplaceLztTitle(raw: string | undefined, game: LztGameKind): boolean {
  const t = stripCyrillic(raw);
  const lower = t.toLowerCase();
  if (!t || lower === "kuki" || lower === "waiting" || lower === "lol" || t.length < 3) return true;
  if (/^[\s|+\-_.:0-9]{1,24}$/.test(t)) return true;
  const compact = t.replace(/\s/g, "");
  if (/^\|+$/.test(compact) || compact === "||") return true;
  if (looksLikeLztMarketDumpTitle(t, game)) return true;
  if (game === "lol") {
    if (/^\(\d+\)_\d+$/.test(t)) return true;
    if (/^\d+_\d+$/.test(t)) return true;
    const letters = (t.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    if (letters < 2 && t.length <= 16) return true;
  }
  if (game === "lol" && /\b\d+\s*knives?\b/i.test(t) && !/\b(champion|league|lol|skin)\b/i.test(t)) return true;
  if (game === "minecraft") {
    if (/^[\s|\-:]+$/.test(t) || /^.?\|.?\|/.test(t)) return true;
    const letters = (t.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    if (letters < 4 && t.length < 28) return true;
  }
  if (game === "genshin" || game === "honkai" || game === "zzz") {
    const letters = (t.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    if (letters < 3 && t.length < 32) return true;
  }
  return false;
}

function valorantRankName(rankId: number | undefined): string {
  if (rankId == null) return "Unranked";
  return rankMap[rankId]?.name ?? "Unranked";
}

/**
 * Título dos cards na listagem Contas: sempre padronizado, limpo e premium.
 */
export function getListingCardTitle(item: LztItemForTitle, game: LztGameKind): string {
  switch (game) {
    case "valorant": {
      const skinCount = item.riot_valorant_skin_count ?? 0;
      const rankName = valorantRankName(item.riot_valorant_rank);
      return `CONTA VALORANT • ${skinCount} SKINS • ${rankName.toUpperCase()}`;
    }
    case "lol": {
      const rankText = item.riot_lol_rank || "Unranked";
      const rankShort = rankText.split(/\s+/)[0] || rankText;
      const level = item.riot_lol_level ?? 0;
      const skinCount = item.riot_lol_skin_count ?? 0;
      return `CONTA LOL • ${skinCount} SKINS • ${rankShort.toUpperCase()} • NV ${level}`;
    }
    case "fortnite": {
      const skinCount = item.fortnite_skin_count ?? item.fortnite_outfit_count ?? 0;
      const level = item.fortnite_level ?? 0;
      let t = `CONTA FORTNITE • ${skinCount} SKINS`;
      if (level > 0) t += ` • NV ${level}`;
      return t;
    }
    case "minecraft": {
      const hasJava = (item.minecraft_java ?? 0) > 0;
      const hasBedrock = (item.minecraft_bedrock ?? 0) > 0;
      const edition =
        hasJava && hasBedrock ? "JAVA + BEDROCK" : hasJava ? "JAVA" : hasBedrock ? "BEDROCK" : "FULL ACCESS";
      const nick = item.minecraft_nickname?.trim();
      return `CONTA MINECRAFT • ${nick ? nick.toUpperCase() : "VERIFICADA"} • ${edition}`;
    }
    case "brawlstars": {
      const br = item.brawlers_count ?? 0;
      const cups = item.brawl_cups ?? 0;
      const lvl = item.brawl_level ?? 0;
      let t = `CONTA BRAWL STARS • ${br} BRAWLERS`;
      if (cups > 0) t += ` • ${cups.toLocaleString("pt-BR")} TROFÉUS`;
      if (lvl > 0) t += ` • NV ${lvl}`;
      return t;
    }
    case "genshin": {
      const ch = Number(item.genshin_char_count ?? 0);
      const leg = Number(item.genshin_legendary_count ?? 0);
      let t = "CONTA GENSHIN IMPACT";
      if (ch > 0) t += ` • ${ch} PERSONAGENS`;
      if (leg > 0) t += ` • ${leg} 5★`;
      return `${t} • VERIFICADA`;
    }
    case "honkai": {
      const ch = Number(item.honkai_char_count ?? 0);
      const eid = Number(item.honkai_eidolon_count ?? 0);
      let t = "CONTA HONKAI STAR RAIL";
      if (ch > 0) t += ` • ${ch} PERSONAGENS`;
      if (eid > 0) t += ` • ${eid} EIDOLONS`;
      return `${t} • VERIFICADA`;
    }
    case "zzz": {
      const ch = Number(item.zenless_char_count ?? 0);
      const leg = Number(item.zenless_legendary_count ?? 0);
      let t = "CONTA ZENLESS ZONE ZERO";
      if (ch > 0) t += ` • ${ch} PERSONAGENS`;
      if (leg > 0) t += ` • ${leg} S-RANK`;
      return `${t} • VERIFICADA`;
    }
  }
}

type DetailCtx =
  | { game: "valorant"; rankName: string; skinCount: number }
  | { game: "fortnite"; skinCount: number; level: number; vbucks: number }
  | { game: "lol"; rankText: string; level: number; skinCount: number }
  | { game: "minecraft"; nickname?: string; hasJava: boolean; hasBedrock: boolean }
  | { game: "brawlstars"; brawlers: number; trophies: number; level: number };

function buildSyntheticDetailTitle(ctx: DetailCtx): string {
  switch (ctx.game) {
    case "valorant":
      return `Conta Valorant · Full Acesso · ${ctx.skinCount} Skins · ${ctx.rankName}`;
    case "fortnite": {
      let s = `Conta Fortnite · Full Acesso · ${ctx.skinCount} Skins`;
      if (ctx.level > 0) s += ` · Nv.${ctx.level}`;
      if (ctx.vbucks > 0) s += ` · ${ctx.vbucks.toLocaleString("pt-BR")} V-Bucks`;
      return s;
    }
    case "lol": {
      const rankShort = ctx.rankText.split(/\s+/)[0] || ctx.rankText;
      return `Conta LoL · Full Acesso · ${ctx.skinCount} Skins · ${rankShort} · Nv.${ctx.level}`;
    }
    case "minecraft": {
      const edition =
        ctx.hasJava && ctx.hasBedrock
          ? "Java + Bedrock"
          : ctx.hasJava
            ? "Java Edition"
            : ctx.hasBedrock
              ? "Bedrock Edition"
              : "Full Access";
      return `Conta Minecraft · Full Acesso · ${ctx.nickname?.trim() || "Conta Verificada"} · ${edition}`;
    }
    case "brawlstars": {
      let s = `Conta Brawl Stars · Full Acesso · ${ctx.brawlers} Brawlers`;
      if (ctx.trophies > 0) s += ` · ${ctx.trophies.toLocaleString("pt-BR")} troféus`;
      if (ctx.level > 0) s += ` · Nv.${ctx.level}`;
      return s;
    }
  }
}

/**
 * Título na página de detalhe: sempre usa título sintético padronizado
 * para consistência com os cards da listagem.
 */
export function getLztDetailDisplayTitle(_rawTitle: string | undefined, ctx: DetailCtx): string {
  return buildSyntheticDetailTitle(ctx);
}
