import { describe, it, expect } from "vitest";
import {
  getDisplayedPriceBrl,
  getContentFloorBrl,
  getContentCeilingBrl,
  shouldKeepItem,
  itemFailsNotSoldBeforePolicy,
  MIN_PRICE_BRL,
  DEFAULT_LZT_FX,
  DEFAULT_MARKUP,
} from "@/lib/lztPricingModel";

describe("getDisplayedPriceBrl", () => {
  it("returns override price when set", () => {
    const result = getDisplayedPriceBrl({ price: 1000, price_currency: "rub" }, 150, "valorant");
    expect(result).toBe(150);
  });

  it("ignores invalid override (0 or negative)", () => {
    const result = getDisplayedPriceBrl({ price: 1000, price_currency: "rub" }, 0, "valorant");
    expect(result).not.toBe(0);
    expect(result).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
  });

  it("never returns below MIN_PRICE_BRL", () => {
    const result = getDisplayedPriceBrl({ price: 1, price_currency: "rub" }, undefined, "valorant");
    expect(result).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
  });

  it("applies markup to RUB conversion", () => {
    const item = { price: 1000, price_currency: "rub", riot_valorant_skin_count: 50 };
    const result = getDisplayedPriceBrl(item, undefined, "valorant", DEFAULT_MARKUP, DEFAULT_LZT_FX);
    const costBrl = 1000 * DEFAULT_LZT_FX.rub;
    // Result should be at least 2x cost (min margin)
    expect(result).toBeGreaterThanOrEqual(costBrl * 2);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("applies markup to USD conversion", () => {
    const item = { price: 10, price_currency: "usd", riot_valorant_skin_count: 30 };
    const result = getDisplayedPriceBrl(item, undefined, "valorant", DEFAULT_MARKUP, DEFAULT_LZT_FX);
    expect(result).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("enforces min profit of R$20", () => {
    // Very cheap item: cost = 0.055 BRL, profit must be ≥ 20
    const item = { price: 1, price_currency: "rub", riot_valorant_skin_count: 0 };
    const result = getDisplayedPriceBrl(item, undefined, "valorant");
    expect(result).toBeGreaterThanOrEqual(20);
  });

  it("result is always rounded to 2 decimals", () => {
    const item = { price: 777, price_currency: "rub", riot_valorant_skin_count: 25 };
    const result = getDisplayedPriceBrl(item, undefined, "valorant");
    const decimals = result.toString().split(".")[1];
    expect(!decimals || decimals.length <= 2).toBe(true);
  });

  it("handles all game types without error", () => {
    const games = ["valorant", "lol", "fortnite", "minecraft"];
    for (const game of games) {
      const result = getDisplayedPriceBrl(
        { price: 500, price_currency: "rub", riot_valorant_skin_count: 20, riot_lol_skin_count: 20, fortnite_skin_count: 20 },
        undefined, game
      );
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
    }
  });
});

describe("getContentFloorBrl", () => {
  it("valorant floor based on skins and knives", () => {
    const floor = getContentFloorBrl({ riot_valorant_skin_count: 100, riot_valorant_knife: 3 }, "valorant");
    expect(floor).toBe(100 * 0.6 + 3 * 5); // 75
  });

  it("fortnite floor includes vbucks", () => {
    const floor = getContentFloorBrl({ fortnite_skin_count: 50, fortnite_vbucks: 5000 }, "fortnite");
    expect(floor).toBe(50 * 0.35 + 5000 * 0.005); // 42.5
  });

  it("lol floor based on skins and champs", () => {
    const floor = getContentFloorBrl({ riot_lol_skin_count: 30, riot_lol_champion_count: 100 }, "lol");
    expect(floor).toBe(30 * 0.5 + 100 * 0.15); // 30
  });

  it("minecraft floor includes java/bedrock", () => {
    const floor = getContentFloorBrl({ minecraft_java: 1, minecraft_bedrock: 1, minecraft_capes_count: 2 }, "minecraft");
    expect(floor).toBe(2 * 2 + 1 * 3 + 1 * 3); // 10
  });
});

describe("getContentCeilingBrl", () => {
  it("never below MIN_PRICE_BRL", () => {
    expect(getContentCeilingBrl({}, "valorant")).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
    expect(getContentCeilingBrl({}, "lol")).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
    expect(getContentCeilingBrl({}, "fortnite")).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
    expect(getContentCeilingBrl({}, "minecraft")).toBeGreaterThanOrEqual(MIN_PRICE_BRL);
  });

  it("lol high rank bonus applied", () => {
    const base = getContentCeilingBrl({ riot_lol_skin_count: 10 }, "lol");
    const withRank = getContentCeilingBrl({ riot_lol_skin_count: 10, riot_lol_rank: "CHALLENGER" }, "lol");
    expect(withRank).toBe(base + 120);
  });

  it("valorant high rank bonus applied", () => {
    const base = getContentCeilingBrl({ riot_valorant_skin_count: 10 }, "valorant");
    const withRank = getContentCeilingBrl({ riot_valorant_skin_count: 10, riot_valorant_rank: 27 }, "valorant");
    expect(withRank).toBe(base + 150);
  });
});

describe("itemFailsNotSoldBeforePolicy", () => {
  it("flags not_sold_before = false", () => {
    expect(itemFailsNotSoldBeforePolicy({ not_sold_before: false })).toBe(true);
  });
  it("flags sold_before = true", () => {
    expect(itemFailsNotSoldBeforePolicy({ sold_before: true })).toBe(true);
  });
  it("passes clean item", () => {
    expect(itemFailsNotSoldBeforePolicy({ not_sold_before: true })).toBe(false);
  });
});

describe("shouldKeepItem", () => {
  const validValorant = {
    price: 300,
    price_currency: "rub",
    riot_valorant_skin_count: 30,
    riot_valorant_knife: 1,
    canBuyItem: true,
    not_sold_before: true,
  };

  it("keeps valid valorant item", () => {
    const price = getDisplayedPriceBrl(validValorant, undefined, "valorant");
    expect(shouldKeepItem(validValorant, "valorant", price)).toBe(true);
  });

  it("rejects item with buyer assigned", () => {
    const item = { ...validValorant, buyer_username: "someone" };
    expect(shouldKeepItem(item, "valorant", 100)).toBe(false);
  });

  it("rejects item with canBuyItem = false", () => {
    const item = { ...validValorant, canBuyItem: false };
    expect(shouldKeepItem(item, "valorant", 100)).toBe(false);
  });

  it("rejects sold_before item", () => {
    const item = { ...validValorant, sold_before: true };
    expect(shouldKeepItem(item, "valorant", 100)).toBe(false);
  });

  it("rejects valorant with < 5 skins", () => {
    const item = { ...validValorant, riot_valorant_skin_count: 3 };
    expect(shouldKeepItem(item, "valorant", 100)).toBe(false);
  });

  it("rejects lol with < 10 skins", () => {
    const item = { ...validValorant, riot_lol_skin_count: 5 };
    expect(shouldKeepItem(item, "lol", 100)).toBe(false);
  });

  it("rejects fortnite with < 10 skins", () => {
    const item = { ...validValorant, fortnite_skin_count: 5 };
    expect(shouldKeepItem(item, "fortnite", 100)).toBe(false);
  });

  it("skips min skins check when opted out", () => {
    const item = { ...validValorant, riot_valorant_skin_count: 2 };
    const price = getDisplayedPriceBrl(item, undefined, "valorant");
    expect(shouldKeepItem(item, "valorant", price, { skipMinSkins: true })).toBe(true);
  });
});
