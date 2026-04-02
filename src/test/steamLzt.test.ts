import { describe, it, expect } from "vitest";
import {
  countSteamGamesOnListItem,
  normalizeSteamGamesFromRaw,
  formatSteamPlaytime,
  resolveSteamHeroImage,
  steamLibraryHeaderImageUrl,
} from "@/lib/steamLzt";

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

  it("resolveSteamHeroImage prefers main over weapons", () => {
    const main = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/xx/x.jpg";
    const weapons = "https://img.lzt.market/bad-collage.png";
    expect(
      resolveSteamHeroImage({
        imagePreviewLinks: { direct: { main, weapons } },
      }),
    ).toBe(main);
  });

  it("resolveSteamHeroImage uses first library appid when no main", () => {
    const url = resolveSteamHeroImage({
      steamGames: [{ appid: 730, name: "Counter-Strike 2" }],
      imagePreviewLinks: { direct: { weapons: "https://img.lzt.market/wrong.png" } },
    });
    expect(url).toBe(steamLibraryHeaderImageUrl(730));
  });

  it("resolveSteamHeroImage allows weapons only on steam CDN", () => {
    const steamWeapons = "https://steamcdn-a.akamaihd.net/something/weapons.png";
    expect(
      resolveSteamHeroImage({
        imagePreviewLinks: { direct: { weapons: steamWeapons } },
      }),
    ).toBe(steamWeapons);
  });
});
