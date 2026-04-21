/**
 * Deduz slug canónico (valorant | lol | fortnite | minecraft) a partir do item bruto da API LZT.
 * Usado no `pix-payment` quando o cliente manda `lztGame` vazio e o título não tem keywords.
 */
export type LztApiItem = Record<string, unknown>;

const RELEVANT_GAME_MAP: Record<string, "valorant" | "lol" | "fortnite" | "minecraft"> = {
  riot: "valorant",
  valorant: "valorant",
  lol: "lol",
  leagueoflegends: "lol",
  fortnite: "fortnite",
  minecraft: "minecraft",
};

function slugFromRelevantGames(item: LztApiItem): string {
  const rg = item["relevant_games"] ?? item["relevantGames"];
  if (!Array.isArray(rg)) return "";
  for (const entry of rg) {
    const key = String(entry ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "");
    const mapped = RELEVANT_GAME_MAP[key];
    if (mapped) return mapped;
  }
  return "";
}

/**
 * Escolhe o jogo com maior “peso” de inventário (contagens típicas LZT).
 */
function slugFromInventoryScores(item: LztApiItem): string {
  const valorant =
    Number(item["riot_valorant_skin_count"] || 0) * 2 +
    Number(item["riot_valorant_agent_count"] || 0) * 3 +
    Number(item["riot_valorant_level"] || 0) * 0.05 +
    Number(item["riot_valorant_knife"] || item["riot_valorant_knife_count"] || 0) * 5;
  const lol =
    Number(item["riot_lol_skin_count"] || 0) * 2 +
    Number(item["riot_lol_champion_count"] || 0) * 2 +
    Number(item["riot_lol_level"] || 0) * 0.05;
  const fortnite =
    Number(item["fortnite_skin_count"] || item["fortnite_outfit_count"] || 0) * 2 +
    Number(item["fortnite_level"] || 0) * 0.05 +
    Number(item["fortnite_vbucks"] || item["fortnite_balance"] || 0) * 0.001;
  const minecraft =
    Number(item["minecraft_capes_count"] || 0) * 4 +
    Number(item["minecraft_hypixel_level"] || 0) * 0.05 +
    (Number(item["minecraft_java"] || 0) + Number(item["minecraft_bedrock"] || 0)) * 3;

  const ranked: Array<[string, number]> = [
    ["valorant", valorant],
    ["lol", lol],
    ["fortnite", fortnite],
    ["minecraft", minecraft],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : "";
}

/** Retorna slug vazio se não for possível deduzir. */
export function inferLztGameSlugFromApiItem(item: LztApiItem | undefined): string {
  if (!item || typeof item !== "object") return "";
  const fromRg = slugFromRelevantGames(item);
  if (fromRg) return fromRg;
  return slugFromInventoryScores(item);
}
