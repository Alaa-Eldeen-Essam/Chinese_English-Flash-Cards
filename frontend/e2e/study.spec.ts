import { test, expect } from "@playwright/test";

test("auth screen renders before login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Sign in")).toBeVisible();
  await expect(page.getByText("Create account")).toBeVisible();
});
