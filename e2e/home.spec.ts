import { expect, test } from "@playwright/test";

test("home loads with title and jump-in panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1.brandHero__title", { hasText: "Kinsa Siya?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Jump in/i })).toBeVisible();
});
