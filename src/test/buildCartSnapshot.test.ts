import { describe, expect, it } from "vitest";
import type { CartItem } from "@/hooks/useCart";
import { buildCartSnapshotFromItems } from "@/lib/buildCartSnapshot";

describe("buildCartSnapshotFromItems", () => {
  it("maps product row with price", () => {
    const items: CartItem[] = [
      {
        productId: "p1",
        productName: "Prod",
        productImage: null,
        planId: "plan",
        planName: "Plano",
        price: 49.9,
        quantity: 2,
      },
    ];
    const snap = buildCartSnapshotFromItems(items);
    expect(snap).toHaveLength(1);
    expect(snap[0].productId).toBe("p1");
    expect(snap[0].quantity).toBe(2);
    expect(snap[0].price).toBe(49.9);
    expect(snap[0].type).toBeUndefined();
  });

  it("includes LZT fields for lzt-account", () => {
    const items: CartItem[] = [
      {
        productId: "lzt-x",
        productName: "Conta",
        productImage: null,
        planId: "lzt-account",
        planName: "Conta Valorant",
        price: 199,
        quantity: 1,
        type: "lzt-account",
        lztItemId: "abc",
        lztGame: "valorant",
        lztPrice: 50,
        lztCurrency: "rub",
        skinsCount: 40,
      },
    ];
    const snap = buildCartSnapshotFromItems(items);
    expect(snap[0].type).toBe("lzt-account");
    expect(snap[0].lztItemId).toBe("abc");
    expect(snap[0].lztGame).toBe("valorant");
    expect(snap[0].lztPrice).toBe(50);
    expect(snap[0].lztCurrency).toBe("rub");
    expect(snap[0].skinsCount).toBe(40);
  });
});
