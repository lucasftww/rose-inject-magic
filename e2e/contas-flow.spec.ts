import { test, expect, type Page } from "@playwright/test";

type MarketItem = {
  item_id: number;
  title: string;
  price: number;
  price_currency: "rub";
  game_type: "riot" | "lol" | "fortnite" | "minecraft";
  pdate: number;
  riot_valorant_skin_count?: number;
  riot_valorant_rank?: string;
};

function buildItem(gameType: MarketItem["game_type"], id: number): MarketItem {
  return {
    item_id: id,
    title: `Conta ${gameType} ${id}`,
    price: 100 + id,
    price_currency: "rub",
    game_type: gameType,
    pdate: Date.now(),
    riot_valorant_skin_count: gameType === "riot" ? 20 : undefined,
    riot_valorant_rank: gameType === "riot" ? "platinum" : undefined,
  };
}

async function mockLztMarket(page: Page): Promise<void> {
  await page.route("**/functions/v1/lzt-market**", async (route) => {
    const reqUrl = new URL(route.request().url());
    const pageParam = Number(reqUrl.searchParams.get("page") || "1");
    const gameTypeParam = reqUrl.searchParams.get("game_type") || "riot";
    const gameType =
      gameTypeParam === "lol" || gameTypeParam === "fortnite" || gameTypeParam === "minecraft"
        ? gameTypeParam
        : "riot";
    const start = (pageParam - 1) * 30 + 1;
    const count = pageParam === 1 ? 30 : 20;
    const items = Array.from({ length: count }, (_, i) => buildItem(gameType, start + i));
    const payload = {
      items,
      hasNextPage: pageParam < 3,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

test.describe("contas flow", () => {
  test("shows clear loading feedback and throttles rapid refresh/load-more", async ({ page }) => {
    await mockLztMarket(page);
    await page.goto("/contas");

    await expect(page.getByRole("heading", { name: /Contas Valorant/i })).toBeVisible();

    const refreshButton = page.getByRole("button", { name: "Atualizar lista de contas" });
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toBeEnabled();

    await refreshButton.click();
    await expect(refreshButton).toBeVisible();

    const loadMoreButton = page.getByRole("button", { name: /Buscar mais contas|Carregando\.\.\.|Aguarde\.\.\./i });
    await expect(loadMoreButton).toBeVisible();
    await expect(loadMoreButton).toBeEnabled();

    await loadMoreButton.click();
    await expect(loadMoreButton).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Buscar mais contas/i }),
    ).toBeEnabled({ timeout: 3000 });

    await expect(page.getByText("Não foi possível carregar a lista. Tente atualizar.")).toHaveCount(0);
  });
});
