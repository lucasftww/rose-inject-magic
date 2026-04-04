import { describe, expect, it } from "vitest";
import {
  getListingCardTitle,
  getLztDetailDisplayTitle,
  looksLikeLztMarketDumpTitle,
  shouldReplaceLztTitle,
} from "@/lib/lztDisplayTitles";

describe("looksLikeLztMarketDumpTitle", () => {
  it("detects Last Match / days ago LZT titles", () => {
    expect(
      looksLikeLztMarketDumpTitle("594 Skins | X | Last Match: 10.01.26 (82 days ago)", "fortnite"),
    ).toBe(true);
    expect(looksLikeLztMarketDumpTitle("ok short title", "fortnite")).toBe(false);
  });
});

describe("shouldReplaceLztTitle", () => {
  it("replaces empty or placeholder titles", () => {
    expect(shouldReplaceLztTitle(undefined, "valorant")).toBe(true);
    expect(shouldReplaceLztTitle("kuki", "valorant")).toBe(true);
  });
});

describe("getListingCardTitle", () => {
  it("returns standardized Fortnite line without raw LZT title", () => {
    expect(
      getListingCardTitle(
        {
          title: "594 Skins | Travis | Last Match: 1.1.26",
          fortnite_skin_count: 594,
        },
        "fortnite",
      ),
    ).toBe("Conta Fortnite · Full acesso · 594 skins");
  });

  it("Valorant includes rank label from riot_valorant_rank", () => {
    expect(
      getListingCardTitle({ riot_valorant_rank: 27, riot_valorant_skin_count: 12 }, "valorant"),
    ).toMatch(/Conta Valorant · Full acesso · 12 skins · Radiante/);
  });
});

describe("getLztDetailDisplayTitle", () => {
  it("uses synthetic title for LZT dump strings", () => {
    const raw = "594 Skins | Foo | Last Match: x (2 days ago)";
    expect(
      getLztDetailDisplayTitle(raw, {
        game: "fortnite",
        skinCount: 594,
        level: 100,
        vbucks: 750,
      }),
    ).toContain("Conta Fortnite · Full acesso · 594 skins");
  });

  it("keeps short clean custom titles", () => {
    expect(
      getLztDetailDisplayTitle("Minha conta top", {
        game: "fortnite",
        skinCount: 1,
        level: 0,
        vbucks: 0,
      }),
    ).toBe("Minha conta top");
  });
});
