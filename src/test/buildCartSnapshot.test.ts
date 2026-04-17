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

  it("includes gameName for LZT and product rows when set", () => {
    const lzt: CartItem[] = [
      {
        productId: "lzt-1",
        productName: "Conta",
        productImage: null,
        planId: "lzt-account",
        planName: "Conta",
        price: 10,
        quantity: 1,
        type: "lzt-account",
        lztItemId: "x",
        lztGame: "valorant",
        gameName: "valorant",
        lztPrice: 1,
        lztCurrency: "rub",
      },
    ];
    const prod: CartItem[] = [
      {
        productId: "p1",
        productName: "Plano",
        productImage: null,
        planId: "plan",
        planName: "30d",
        price: 20,
        quantity: 1,
        gameName: "cs2",
      },
    ];
    expect(buildCartSnapshotFromItems(lzt)[0].gameName).toBe("valorant");
    expect(buildCartSnapshotFromItems(prod)[0].gameName).toBe("cs2");
  });
});
