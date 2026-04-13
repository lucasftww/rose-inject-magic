import { describe, it, expect } from "vitest";

/**
 * Tests for cart localStorage normalization — ensures corrupt/malicious
 * cart data never produces NaN totals or invalid checkout payloads.
 *
 * The normalizeCartItemsFromStorage function is not exported, so we
 * replicate its logic here to validate the contract.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

interface CartItem {
  productId: string;
  productName: string;
  productImage: string | null;
  planId: string;
  planName: string;
  price: number;
  quantity: number;
  type?: "product" | "lzt-account";
  lztItemId?: string;
  lztPrice?: number;
  lztCurrency?: string;
  lztGame?: string;
  skinsCount?: number;
}

function normalizeCartItemsFromStorage(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  const out: CartItem[] = [];
  for (const row of parsed) {
    if (!isRecord(row)) continue;
    const o = row;
    const productId = typeof o.productId === "string" ? o.productId : String(o.productId ?? "").trim();
    const planId = typeof o.planId === "string" ? o.planId : String(o.planId ?? "").trim();
    if (!productId || !planId) continue;
    let price = Number(o.price);
    let quantity = Number(o.quantity);
    if (!Number.isFinite(price) || price < 0) price = 0;
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    quantity = Math.max(1, Math.floor(quantity));
    const productName = typeof o.productName === "string" && o.productName.trim() ? o.productName : "Item";
    const planName = typeof o.planName === "string" && o.planName.trim() ? o.planName : "—";
    const productImage = o.productImage === null ? null : typeof o.productImage === "string" ? o.productImage : null;
    const item: CartItem = { productId, productName, productImage, planId, planName, price, quantity };
    if (o.type === "lzt-account") {
      item.type = "lzt-account";
      item.quantity = 1;
      if (typeof o.lztItemId === "string" && o.lztItemId) item.lztItemId = o.lztItemId;
      if (typeof o.lztGame === "string") item.lztGame = o.lztGame;
      const lp = Number(o.lztPrice);
      if (Number.isFinite(lp) && lp >= 0) item.lztPrice = lp;
      if (typeof o.lztCurrency === "string") item.lztCurrency = o.lztCurrency;
      const sc = Number(o.skinsCount);
      if (Number.isFinite(sc) && sc >= 0) item.skinsCount = sc;
    }
    out.push(item);
  }
  return out;
}

function computeTotals(items: CartItem[]) {
  const totalItems = items.reduce((sum, i) => {
    const q = Number.isFinite(i.quantity) && i.quantity >= 1 ? Math.floor(i.quantity) : 0;
    return sum + q;
  }, 0);
  const totalPrice = items.reduce((sum, i) => {
    const p = Number.isFinite(i.price) && i.price >= 0 ? i.price : 0;
    const q = Number.isFinite(i.quantity) && i.quantity >= 1 ? Math.floor(i.quantity) : 0;
    return sum + p * q;
  }, 0);
  return { totalItems, totalPrice };
}

describe("Cart normalization - corrupt data resilience", () => {
  it("rejects non-array input", () => {
    expect(normalizeCartItemsFromStorage(null)).toEqual([]);
    expect(normalizeCartItemsFromStorage("string")).toEqual([]);
    expect(normalizeCartItemsFromStorage(42)).toEqual([]);
    expect(normalizeCartItemsFromStorage({})).toEqual([]);
  });

  it("rejects rows missing productId or planId", () => {
    const result = normalizeCartItemsFromStorage([
      { productId: "", planId: "p1", price: 10, quantity: 1 },
      { productId: "a", planId: "", price: 10, quantity: 1 },
      { price: 10, quantity: 1 },
    ]);
    expect(result).toHaveLength(0);
  });

  it("sanitizes NaN price to 0", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: "not-a-number", quantity: 1, productName: "Test" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(0);
    expect(Number.isFinite(items[0].price)).toBe(true);
  });

  it("sanitizes negative price to 0", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: -50, quantity: 1, productName: "Test" },
    ]);
    expect(items[0].price).toBe(0);
  });

  it("sanitizes Infinity price to 0", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: Infinity, quantity: 1, productName: "Test" },
    ]);
    expect(items[0].price).toBe(0);
  });

  it("sanitizes zero/negative quantity to 1", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: 10, quantity: 0, productName: "Test" },
      { productId: "y", planId: "p", price: 10, quantity: -5, productName: "Test2" },
    ]);
    expect(items[0].quantity).toBe(1);
    expect(items[1].quantity).toBe(1);
  });

  it("floors fractional quantity", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: 10, quantity: 2.9, productName: "Test" },
    ]);
    expect(items[0].quantity).toBe(2);
  });

  it("forces lzt-account quantity to 1", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "lzt", price: 100, quantity: 5, type: "lzt-account", lztItemId: "abc" },
    ]);
    expect(items[0].quantity).toBe(1);
  });

  it("rejects NaN lztPrice", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "lzt", price: 100, quantity: 1, type: "lzt-account", lztPrice: NaN },
    ]);
    expect(items[0].lztPrice).toBeUndefined();
  });

  it("provides default productName and planName", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "x", planId: "p", price: 10, quantity: 1 },
    ]);
    expect(items[0].productName).toBe("Item");
    expect(items[0].planName).toBe("—");
  });
});

describe("Cart totals - never NaN", () => {
  it("totals are finite even with edge-case items", () => {
    const items = normalizeCartItemsFromStorage([
      { productId: "a", planId: "p", price: NaN, quantity: NaN },
      { productId: "b", planId: "q", price: Infinity, quantity: -1 },
      { productId: "c", planId: "r", price: 49.9, quantity: 2 },
    ]);
    const { totalItems, totalPrice } = computeTotals(items);
    expect(Number.isFinite(totalItems)).toBe(true);
    expect(Number.isFinite(totalPrice)).toBe(true);
    expect(totalPrice).toBeGreaterThanOrEqual(0);
    // Only the valid item (c) contributes: 49.9 * 2 = 99.8
    expect(totalPrice).toBeCloseTo(99.8, 1);
    // a=1 (sanitized), b=1 (sanitized), c=2
    expect(totalItems).toBe(4);
  });
});
