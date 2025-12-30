import { test, expect } from "@playwright/test";

test("study flow handles offline mode", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Dashboard")).toBeVisible();

  await page.getByRole("button", { name: "Study" }).click();
  await expect(page.getByText("Study Session")).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
});
