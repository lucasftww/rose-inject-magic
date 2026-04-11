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

  it("accepts stickied / pre_active (still listed on LZT)", () => {
    expect(isLztDetailItemPurchasable({ item_state: "stickied", canBuyItem: true })).toBe(true);
    expect(isLztDetailItemPurchasable({ item_state: "pre_active", canBuyItem: true })).toBe(true);
    expect(isLztDetailItemPurchasable({ item_state: "discount_requests", canBuyItem: true })).toBe(true);
  });

  it("treats empty buyer object as no buyer", () => {
    expect(isLztDetailItemPurchasable({ item_state: "active", buyer: {}, canBuyItem: true })).toBe(true);
  });

  it("rejects sold or closed", () => {
    expect(isLztDetailItemPurchasable({ item_state: "closed" })).toBe(false);
    expect(isLztDetailItemPurchasable({ buyer: { id: 1 } })).toBe(false);
    expect(isLztDetailItemPurchasable({ item_state: "active", buyer_username: "sold_user", canBuyItem: true })).toBe(
      false,
    );
    expect(isLztDetailItemPurchasable({ canBuyItem: false })).toBe(false);
  });

  it("rejects accounts sold before on LZT (policy flags)", () => {
    expect(isLztDetailItemPurchasable({ item_state: "active", not_sold_before: false })).toBe(false);
    expect(isLztDetailItemPurchasable({ item_state: "active", sold_before: true })).toBe(false);
    expect(isLztDetailItemPurchasable({ item_state: "active", notSoldBefore: false })).toBe(false);
  });
});

describe("lztAccountDetailQueryKey", () => {
  it("matches detail page query shape", () => {
    expect(lztAccountDetailQueryKey("valorant", "abc")).toEqual(["lzt-account-detail", "valorant", "abc"]);
  });
});
