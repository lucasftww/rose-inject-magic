import { describe, expect, it } from "vitest";
import { isLztDetailItemPurchasable } from "@/lib/lztAvailability";
import { lztAccountDetailQueryKey } from "@/lib/lztAccountDetailQuery";

describe("isLztDetailItemPurchasable", () => {
  it("accepts active item without buyer", () => {
    expect(
      isLztDetailItemPurchasable({
        item_id: "123",
        item_state: "active",
        canBuyItem: true,
      }),
    ).toBe(true);
  });

  it("rejects sold or closed", () => {
    expect(isLztDetailItemPurchasable({ item_state: "closed" })).toBe(false);
    expect(isLztDetailItemPurchasable({ buyer: { id: 1 } })).toBe(false);
    expect(isLztDetailItemPurchasable({ canBuyItem: false })).toBe(false);
  });
});

describe("lztAccountDetailQueryKey", () => {
  it("matches detail page query shape", () => {
    expect(lztAccountDetailQueryKey("valorant", "abc")).toEqual(["lzt-account-detail", "valorant", "abc"]);
  });
});
