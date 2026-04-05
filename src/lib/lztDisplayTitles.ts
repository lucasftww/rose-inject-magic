import { rankMap } from "@/lib/valorantData";

type LztGameKind = "valorant" | "lol" | "fortnite" | "minecraft";

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
  }
}

type DetailCtx =
  | { game: "valorant"; rankName: string; skinCount: number }
  | { game: "fortnite"; skinCount: number; level: number; vbucks: number }
  | { game: "lol"; rankText: string; level: number; skinCount: number }
  | { game: "minecraft"; nickname?: string; hasJava: boolean; hasBedrock: boolean };

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
  }
}

/**
 * Título na página de detalhe: mantém texto curto limpo se existir; senão (ou lixo LZT) usa sintético.
 */
export function getLztDetailDisplayTitle(rawTitle: string | undefined, ctx: DetailCtx): string {
  const stripped = stripCyrillic(rawTitle);
  const lower = stripped.toLowerCase();
  if (!stripped || lower === "kuki" || stripped.length < 3 || shouldReplaceLztTitle(rawTitle, ctx.game)) {
    return buildSyntheticDetailTitle(ctx);
  }
  if (stripped.length > 120) {
    return buildSyntheticDetailTitle(ctx);
  }
  return stripped;
}
