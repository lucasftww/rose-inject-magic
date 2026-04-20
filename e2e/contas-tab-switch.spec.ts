import { test, expect, type Page } from "@playwright/test";

type MarketItem = {
  item_id: number;
  title: string;
  price: number;
  price_currency: "rub";
  game_type: "riot" | "lol" | "fortnite" | "minecraft";
  pdate: number;
  riot_valorant_skin_count?: number;
  fortnite_skin_count?: number;
  minecraft_java?: number;
};

function buildItem(gameType: MarketItem["game_type"], id: number): MarketItem {
  return {
    item_id: id,
    title: `Conta ${gameType} ${id}`,
    price: 100 + id,
    price_currency: "rub",
    game_type: gameType,
    pdate: Date.now(),
    riot_valorant_skin_count: gameType === "riot" ? 18 : undefined,
    fortnite_skin_count: gameType === "fortnite" ? 25 : undefined,
    minecraft_java: gameType === "minecraft" ? 1 : undefined,
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
    const count = pageParam === 1 ? 30 : 15;
    const items = Array.from({ length: count }, (_, i) => buildItem(gameType, start + i));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items,
        hasNextPage: pageParam < 2,
      }),
    });
  });
}

test.describe("contas tab switching", () => {
  test("handles rapid tab changes and keeps UI consistent", async ({ page }) => {
    await mockLztMarket(page);
    await page.goto("/contas");

    await expect(page.getByRole("heading", { name: /Contas Valorant/i })).toBeVisible();

    const minecraftTab = page.getByRole("button", { name: /Minecraft/i }).first();
    const fortniteTab = page.getByRole("button", { name: /Fortnite/i }).first();

    // Rapid switch sequence to stress abort/queue paths.
    await minecraftTab.click();
    await fortniteTab.click();
    await minecraftTab.click();

    await expect(page.getByRole("heading", { name: /Contas Minecraft/i })).toBeVisible();
    await expect(
      page.getByText(/contas listadas|conta listada|Buscando contas disponíveis…/i),
    ).toBeVisible();

    // Open mobile filters button if present and ensure list remains healthy afterwards.
    const filtrosButton = page.getByRole("button", { name: /^Filtros$/i }).first();
    if (await filtrosButton.isVisible().catch(() => false)) {
      await filtrosButton.click();
      await page.getByRole("button", { name: /Ver resultados/i }).click();
    }

    await expect(page.getByText("Não foi possível carregar a lista. Tente atualizar.")).toHaveCount(0);
  });
});
