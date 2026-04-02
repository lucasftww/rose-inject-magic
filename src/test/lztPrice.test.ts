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
});
