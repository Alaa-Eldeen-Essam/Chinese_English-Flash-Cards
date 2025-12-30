import { test, expect } from "@playwright/test";

test("auth screen renders before login", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Simplified Chinese Flashcards" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
