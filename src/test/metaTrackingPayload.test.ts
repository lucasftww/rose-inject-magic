import { describe, it, expect } from "vitest";
import { buildMetaPurchasePayloadFromCartItems } from "@/lib/buildMetaPurchasePayload";
import type { CartItem } from "@/hooks/useCart";

/** Alinha com páginas LZT (ContaDetalhes, LolDetalhes, etc.): slug canónico em `lztGame`. */
function makeLztAccount(overrides?: Partial<CartItem>): CartItem {
  return {
    productId: "lzt-1",
    productName: "Conta teste",
    productImage: null,
    planId: "lzt-account",
    planName: "Conta",
    price: 100,
    quantity: 1,
    type: "lzt-account",
    lztItemId: "item-1",
    lztGame: "valorant",
    lztPrice: 10,
    lztCurrency: "rub",
    ...overrides,
  };
}

describe("Meta IC/Purchase — section + content_category (regras Events Manager)", () => {
  it.each([
    { lztGame: "valorant" as const, expectedCategory: "valorant" },
    { lztGame: "lol" as const, expectedCategory: "lol" },
    { lztGame: "League of Legends" as const, expectedCategory: "lol" },
    { lztGame: "fortnite" as const, expectedCategory: "fortnite" },
    { lztGame: "Fortnite Battle Royale" as const, expectedCategory: "fortnite" },
    { lztGame: "minecraft" as const, expectedCategory: "minecraft" },
    { lztGame: "Minecraft Java" as const, expectedCategory: "minecraft" },
  ] as const)("contas puras: section=contas, content_category=%s", ({ lztGame, expectedCategory }) => {
    const p = buildMetaPurchasePayloadFromCartItems([makeLztAccount({ lztGame })], 99.9);
    expect(p).not.toBeNull();
    expect(p!.section).toBe("contas");
    expect(p!.contentCategory).toBe(expectedCategory);
  });

  it("carrinho misto (conta + produto) → section=multi; content_category=multi se jogos diferentes", () => {
    const conta = makeLztAccount({ lztGame: "valorant", productId: "lzt-a" });
    const produto: CartItem = {
      productId: "prod-x",
      productName: "Cheat",
      productImage: null,
      planId: "plan",
      planName: "30d",
      price: 50,
      quantity: 1,
      type: "product",
      gameName: "fortnite",
    };
    const p = buildMetaPurchasePayloadFromCartItems([conta, produto], 150);
    expect(p).not.toBeNull();
    expect(p!.section).toBe("multi");
    expect(p!.contentCategory).toBe("multi");
  });

  it("duas contas LZT com jogos diferentes → content_category=multi, section=contas", () => {
    const p = buildMetaPurchasePayloadFromCartItems(
      [
        makeLztAccount({ productId: "lzt-1", lztGame: "valorant" }),
        makeLztAccount({ productId: "lzt-2", lztGame: "lol", lztItemId: "item-2" }),
      ],
      200,
    );
    expect(p).not.toBeNull();
    expect(p!.section).toBe("contas");
    expect(p!.contentCategory).toBe("multi");
  });

  it("produto só Robot (sem lzt-account) → section=produtos", () => {
    const produto: CartItem = {
      productId: "robot-1",
      productName: "Plano",
      productImage: null,
      planId: "p1",
      planName: "30d",
      price: 29.9,
      quantity: 1,
      type: "product",
      gameName: "valorant",
    };
    const p = buildMetaPurchasePayloadFromCartItems([produto], 29.9);
    expect(p).not.toBeNull();
    expect(p!.section).toBe("produtos");
    expect(p!.contentCategory).toBe("valorant");
  });

  it("conta sem lztGame nem gameName → sem contentCategory (só section contas)", () => {
    const p = buildMetaPurchasePayloadFromCartItems(
      [makeLztAccount({ lztGame: undefined, gameName: undefined, productName: "Conta teste" })],
      50,
    );
    expect(p).not.toBeNull();
    expect(p!.section).toBe("contas");
    expect(p!.contentCategory).toBeUndefined();
  });

  it("conta sem lztGame mas productName com Fortnite → content_category=fortnite (regra Meta IC)", () => {
    const p = buildMetaPurchasePayloadFromCartItems(
      [
        makeLztAccount({
          lztGame: undefined,
          gameName: undefined,
          productName: "Conta Fortnite — 120 skins · nível 250",
        }),
      ],
      199,
    );
    expect(p).not.toBeNull();
    expect(p!.section).toBe("contas");
    expect(p!.contentCategory).toBe("fortnite");
  });
});
