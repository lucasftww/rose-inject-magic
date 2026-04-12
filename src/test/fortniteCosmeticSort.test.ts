import { describe, it, expect } from "vitest";
import {
  ageKeyFromIntroduction,
  compareFortniteCardRows,
  raritySortScore,
} from "@/lib/fortniteCosmeticSort";

describe("fortniteCosmeticSort", () => {
  it("raritySortScore orders mythic above rare", () => {
    expect(raritySortScore("mythic")).toBeGreaterThan(raritySortScore("rare"));
    expect(raritySortScore("legendary")).toBeGreaterThan(raritySortScore("uncommon"));
  });

  it("ageKeyFromIntroduction parses chapter/season", () => {
    expect(ageKeyFromIntroduction({ chapter: "1", season: "3" })).toBe(103);
    expect(ageKeyFromIntroduction({ chapter: "2", season: "1" })).toBe(201);
    expect(ageKeyFromIntroduction(null)).toBe(999999);
  });

  it("compareFortniteCardRows prefers higher rarity then older season", () => {
    const a = { name: "A", image: "", rarityValue: "rare", ageKey: 200 };
    const b = { name: "B", image: "", rarityValue: "legendary", ageKey: 103 };
    expect(compareFortniteCardRows(a, b)).toBeGreaterThan(0); // b first

    const c1 = { name: "C", image: "", rarityValue: "legendary", ageKey: 108 };
    const c2 = { name: "D", image: "", rarityValue: "legendary", ageKey: 103 };
    expect(compareFortniteCardRows(c1, c2)).toBeGreaterThan(0); // c2 older first
  });
});
