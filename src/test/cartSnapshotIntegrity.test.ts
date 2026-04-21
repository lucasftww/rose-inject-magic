import { describe, it, expect } from "vitest";
import { buildCartSnapshotFromItems } from "@/lib/buildCartSnapshot";
import { buildMetaPurchasePayloadFromCartItems } from "@/lib/buildMetaPurchasePayload";
import type { CartItem } from "@/hooks/useCart";

/** Helper to create a standard product cart item */
function makeProduct(overrides?: Partial<CartItem>): CartItem {
  return {
    productId: "prod-1",
    productName: "Robot Valorant",
    productImage: "https://example.com/img.png",
    planId: "plan-30d",
    planName: "30 Dias",
    price: 29.9,
    quantity: 1,
    ...overrides,
  };
}

/** Helper to create an LZT account cart item */
function makeLzt(overrides?: Partial<CartItem>): CartItem {
  return {
    productId: "lzt-12345",
    productName: "Conta Valorant #12345",
    productImage: null,
    planId: "lzt-account",
    planName: "Conta LZT",
    price: 189.5,
    quantity: 1,
    type: "lzt-account",
    lztItemId: "12345",
    lztGame: "valorant",
    lztPrice: 350,
    lztCurrency: "rub",
    skinsCount: 45,
    ...overrides,
  };
}

describe("buildCartSnapshotFromItems - payment payload integrity", () => {
  it("standard product snapshot has all required fields", () => {
    const snap = buildCartSnapshotFromItems([makeProduct()]);
    expect(snap).toHaveLength(1);
    const s = snap[0];
    expect(s.productId).toBe("prod-1");
    expect(s.planId).toBe("plan-30d");
    expect(s.price).toBe(29.9);
    expect(s.quantity).toBe(1);
    expect(s.productName).toBe("Robot Valorant");
    // Standard products should not have LZT fields
    expect(s.type).toBeUndefined();
    expect(s.lztItemId).toBeUndefined();
  });

  it("LZT account snapshot includes all LZT-specific fields", () => {
    const snap = buildCartSnapshotFromItems([makeLzt()]);
    const s = snap[0];
    expect(s.type).toBe("lzt-account");
    expect(s.lztItemId).toBe("12345");
    expect(s.lztGame).toBe("valorant");
    expect(s.lztPrice).toBe(350);
    expect(s.lztCurrency).toBe("rub");
    expect(s.skinsCount).toBe(45);
    expect(s.price).toBe(189.5);
  });

  it("LZT snapshot without skinsCount omits the field", () => {
    const snap = buildCartSnapshotFromItems([makeLzt({ skinsCount: undefined })]);
    expect(snap[0].skinsCount).toBeUndefined();
  });

  it("LZT snapshot sem lztGame infere slug pelo productName (grava no pagamento / CAPI)", () => {
    const snap = buildCartSnapshotFromItems([makeLzt({ lztGame: undefined })]);
    expect(snap[0].lztGame).toBe("valorant");
    expect(snap[0].gameName).toBe("valorant");
  });

  it("handles mixed cart (product + LZT)", () => {
    const snap = buildCartSnapshotFromItems([makeProduct(), makeLzt()]);
    expect(snap).toHaveLength(2);
    expect(snap[0].type).toBeUndefined();
    expect(snap[1].type).toBe("lzt-account");
  });

  it("preserves quantity for non-LZT items", () => {
    const snap = buildCartSnapshotFromItems([makeProduct({ quantity: 3 })]);
    expect(snap[0].quantity).toBe(3);
  });
});

describe("buildMetaPurchasePayloadFromCartItems - Meta CAPI payload", () => {
  it("single product generates correct Meta payload", () => {
    const payload = buildMetaPurchasePayloadFromCartItems([makeProduct()], 29.9);
    expect(payload).not.toBeNull();
    expect(payload!.contentIds).toEqual(["prod-1"]);
    expect(payload!.contents).toEqual([{ id: "prod-1", quantity: 1 }]);
    expect(payload!.contentName).toBe("Robot Valorant");
    expect(payload!.value).toBe(29.9);
  });

  it("LZT account generates correct Meta payload", () => {
    const payload = buildMetaPurchasePayloadFromCartItems([makeLzt()], 189.5);
    expect(payload).not.toBeNull();
    expect(payload!.contentIds).toEqual(["lzt-12345"]);
    expect(payload!.value).toBe(189.5);
  });

  it("truncates long contentName", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeProduct({ productId: `p${i}`, productName: `Produto com nome bem grande número ${i}` })
    );
    const payload = buildMetaPurchasePayloadFromCartItems(items, 500);
    expect(payload).not.toBeNull();
    expect(payload!.contentName.length).toBeLessThanOrEqual(500);
  });

  it("quantity floor is at least 1", () => {
    const payload = buildMetaPurchasePayloadFromCartItems(
      [makeProduct({ quantity: 0 })], 0
    );
    expect(payload!.contents[0].quantity).toBe(1);
  });

  it("handles NaN quantity gracefully", () => {
    const payload = buildMetaPurchasePayloadFromCartItems(
      [makeProduct({ quantity: NaN as unknown as number })], 0
    );
    expect(payload!.contents[0].quantity).toBe(1);
  });
});
