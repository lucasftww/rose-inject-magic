import { describe, it, expect } from "vitest";
import { inferLztGameSlugFromApiItem } from "../../supabase/functions/_shared/inferLztGameFromApiItem.ts";

describe("inferLztGameSlugFromApiItem", () => {
  it("usa relevant_games (riot → valorant)", () => {
    expect(inferLztGameSlugFromApiItem({ relevant_games: ["riot"], price: 100 })).toBe("valorant");
    expect(inferLztGameSlugFromApiItem({ relevantGames: ["fortnite"] })).toBe("fortnite");
  });

  it("deduz pelo inventário Valorant", () => {
    expect(
      inferLztGameSlugFromApiItem({
        riot_valorant_skin_count: 40,
        riot_lol_skin_count: 0,
      }),
    ).toBe("valorant");
  });

  it("deduz pelo inventário LoL quando domina", () => {
    expect(
      inferLztGameSlugFromApiItem({
        riot_lol_skin_count: 80,
        riot_lol_champion_count: 120,
        riot_valorant_skin_count: 2,
      }),
    ).toBe("lol");
  });

  it("deduz Fortnite por skins", () => {
    expect(
      inferLztGameSlugFromApiItem({
        fortnite_skin_count: 50,
        riot_valorant_skin_count: 0,
      }),
    ).toBe("fortnite");
  });

  it("deduz Minecraft por capes / hypixel", () => {
    expect(
      inferLztGameSlugFromApiItem({
        minecraft_capes_count: 3,
        minecraft_hypixel_level: 120,
      }),
    ).toBe("minecraft");
  });

  it("relevant_games tem prioridade sobre inventário vazio", () => {
    expect(inferLztGameSlugFromApiItem({ relevant_games: ["minecraft"], riot_valorant_skin_count: 0 })).toBe(
      "minecraft",
    );
  });

  it("sem sinais retorna string vazia", () => {
    expect(inferLztGameSlugFromApiItem({ price: 1 })).toBe("");
    expect(inferLztGameSlugFromApiItem(undefined)).toBe("");
  });
});
