import { describe, it, expect } from "vitest";
import { getLztItemBrlPrice, calcLztFallbackBrl } from "@/hooks/useLztMarkup";

describe("getLztItemBrlPrice", () => {
  it("uses API price_brl when valid", () => {
    expect(getLztItemBrlPrice({ price: 999, price_currency: "rub", price_brl: 150.5 }, "valorant")).toBe(150.5);
  });

  it("ignores invalid price_brl and falls back", () => {
    expect(getLztItemBrlPrice({ price: 1000, price_currency: "rub", price_brl: NaN }, "valorant")).toBeGreaterThan(20);
    expect(getLztItemBrlPrice({ price: 1000, price_currency: "rub", price_brl: 0 }, "valorant")).toBeGreaterThan(20);
  });

  it("fallback rub conversion is stable", () => {
    const brl = calcLztFallbackBrl(1000, "rub");
    expect(brl).toBeGreaterThanOrEqual(20);
    expect(Number.isFinite(brl)).toBe(true);
  });

  it("fallback usd uses USD rate and markup", () => {
    const brl = calcLztFallbackBrl(10, "usd");
    expect(brl).toBeGreaterThanOrEqual(20);
  });

  it("fallback brl path uses same markup multiplier as rub/usd fallback (3×)", () => {
    const brl = calcLztFallbackBrl(100, "brl");
    expect(brl).toBe(300);
  });
});
