import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("builder stays usable when one built-in asset request fails", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const consoleErrors: string[] = [];
  let abortedTreeRequests = 0;

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.route("**/tree_oak.glb", async (route) => {
    abortedTreeRequests += 1;
    await route.abort("failed");
  });

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  const paletteButtons = page.locator("#builder-palette button");
  await expect(paletteButtons.first()).toBeVisible();
  expect(await paletteButtons.count()).toBeGreaterThan(0);

  await page.locator("#builder-palette button", { hasText: "Tree Oak" }).click();
  await page.locator("#builder-place-asset").click();

  await page.locator("#builder-palette button", { hasText: "Bush Detailed" }).click();
  await page.locator("#builder-place-asset").click();

  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-");

  expect(abortedTreeRequests).toBeGreaterThan(0);

  const blockingBootstrapErrors = consoleErrors.filter(
    (message) => message.includes("[browser-debug] bootstrap:error") || message.includes("Skill Garden could not boot")
  );
  expect(blockingBootstrapErrors).toHaveLength(0);
  expect(pageErrors, "No uncaught browser page errors should occur for startup asset-request failures.").toHaveLength(0);
});
