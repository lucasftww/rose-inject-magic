import { describe, it, expect } from "vitest";
import { countSteamGamesOnListItem, normalizeSteamGamesFromRaw, formatSteamPlaytime } from "@/lib/steamLzt";

describe("steamLzt", () => {
  it("normalizes array of game objects", () => {
    const games = normalizeSteamGamesFromRaw({
      steamGames: [
        { appid: 730, name: "Counter-Strike 2", playtime_forever: 120 },
        { name: "Only name" },
      ],
    });
    expect(games).toHaveLength(2);
    expect(games[0].appid).toBe(730);
    expect(games[0].playtimeMinutes).toBe(120);
  });

  it("counts games from steam_games_count", () => {
    expect(countSteamGamesOnListItem({ steam_games_count: 42 })).toBe(42);
  });

  it("formats playtime", () => {
    expect(formatSteamPlaytime(90)).toContain("1");
    expect(formatSteamPlaytime(0)).toBe("");
  });
});
