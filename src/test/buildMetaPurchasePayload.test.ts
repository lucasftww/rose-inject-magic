import { describe, it, expect } from "vitest";
import { buildMetaPurchasePayloadFromCartItems } from "@/lib/buildMetaPurchasePayload";
import type { CartItem } from "@/hooks/useCart";

describe("buildMetaPurchasePayloadFromCartItems", () => {
  it("returns null for empty cart", () => {
    expect(buildMetaPurchasePayloadFromCartItems([], 10)).toBeNull();
  });

  it("builds multi-line name and contents", () => {
    const items: CartItem[] = [
      {
        productId: "a",
        productName: "Alpha",
        productImage: null,
        planId: "p1",
        planName: "Plan",
        price: 1,
        quantity: 2,
      },
      {
        productId: "b",
        productName: "Beta",
        productImage: null,
        planId: "p2",
        planName: "Plan",
        price: 2,
        quantity: 1,
      },
    ];
    const out = buildMetaPurchasePayloadFromCartItems(items, 0);
    expect(out).not.toBeNull();
    expect(out!.contentIds).toEqual(["a", "b"]);
    expect(out!.contents).toEqual([
      { id: "a", quantity: 2 },
      { id: "b", quantity: 1 },
    ]);
    expect(out!.contentName).toContain("Alpha");
    expect(out!.contentName).toContain("Beta");
    expect(out!.value).toBe(0);
  });
});
