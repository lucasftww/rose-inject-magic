import lolRankFerroImg from "@/assets/lol-rank-ferro.webp";
import lolRankBronzeImg from "@/assets/lol-rank-bronze.webp";
import lolRankPrataImg from "@/assets/lol-rank-prata.webp";
import lolRankOuroImg from "@/assets/lol-rank-ouro.webp";
import lolRankPlatinaImg from "@/assets/lol-rank-platina.webp";
import lolRankEsmeraldaImg from "@/assets/lol-rank-esmeralda.webp";
import lolRankDiamanteImg from "@/assets/lol-rank-diamante.webp";
import lolRankMestreImg from "@/assets/lol-rank-mestre.webp";

export const lolRankFilters = [
  { id: "todos", name: "Todos", color: "hsl(var(--muted-foreground))", img: null as string | null },
  { id: "iron", name: "Ferro", color: "#7e6a5e", img: lolRankFerroImg },
  { id: "bronze", name: "Bronze", color: "#a0603c", img: lolRankBronzeImg },
  { id: "silver", name: "Prata", color: "#7f9eb4", img: lolRankPrataImg },
  { id: "gold", name: "Ouro", color: "#c89b3c", img: lolRankOuroImg },
  { id: "platinum", name: "Platina", color: "#4a9e7f", img: lolRankPlatinaImg },
  { id: "emerald", name: "Esmeralda", color: "#2dce89", img: lolRankEsmeraldaImg },
  { id: "diamond", name: "Diamante", color: "#576bde", img: lolRankDiamanteImg },
  { id: "master", name: "Mestre+", color: "#9d48e0", img: lolRankMestreImg },
];

export function lolRankToFilterId(rank: string): string {
  if (!rank || rank === "Unranked") return "todos";
  const r = rank.toUpperCase();
  if (r.includes("IRON")) return "iron";
  if (r.includes("BRONZE")) return "bronze";
  if (r.includes("SILVER")) return "silver";
  if (r.includes("GOLD")) return "gold";
  if (r.includes("PLATINUM")) return "platinum";
  if (r.includes("EMERALD")) return "emerald";
  if (r.includes("DIAMOND")) return "diamond";
  if (r.includes("MASTER") || r.includes("GRANDMASTER") || r.includes("CHALLENGER")) return "master";
  return "todos";
}
