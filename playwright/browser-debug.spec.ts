import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners, normalizeInlineText } from "./browserDebugTestUtils";

test("forwards browser console output and page errors", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#menu-panel")).toBeVisible();
  await expect(page.locator("#renderCanvas")).toBeHidden();
  await expect(page.locator("#menu-build-new")).toBeVisible();
  await expect(page.locator("#app-title")).toHaveText("Skill Garden");

  const menuText = await page.locator("#menu-panel").innerText();
  console.log(`[browser:ready] ${normalizeInlineText(menuText)}`);

  expect(pageErrors, "No uncaught browser page errors should occur during bootstrap.").toHaveLength(0);
});