import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("prompts before leaving builder with unsaved changes", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette button").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed");

  page.once("dialog", async (dialog) => {
    await dialog.dismiss();
  });
  await page.locator("#builder-back-to-menu").click();
  await expect(page.locator("#builder-workspace")).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.locator("#builder-back-to-menu").click();
  await expect(page.locator("#menu-panel")).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur during unsaved-change guard flow.").toHaveLength(0);
});
