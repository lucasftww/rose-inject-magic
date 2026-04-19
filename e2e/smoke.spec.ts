import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home loads with expected title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Royal Store/i);
  });

  test("home renders root content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
  });
});
