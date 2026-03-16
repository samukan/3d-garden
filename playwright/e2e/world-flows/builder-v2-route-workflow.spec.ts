import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("v2 route workflow keeps mode, inspector, create, delete confirm, and tab switching stable", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&builderShell=v2&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await expect(page.locator("#builder-inspector-tab-object")).toHaveAttribute("aria-selected", "true");

  await page.locator("#builder-route-mode-toggle").click();
  await expect(page.locator("#builder-route-mode-toggle")).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator("#builder-inspector-tab-route")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#builder-inspector-route-panel")).toBeVisible();

  const routeSelect = page.locator("#builder-v2-route-select");
  const routeNameInput = page.locator("#builder-v2-route-name");
  const addPointButton = page.locator("#builder-v2-route-add-point");
  const createRouteButton = page.locator("#builder-v2-route-create");
  const deleteRouteButton = page.locator("#builder-v2-route-delete");

  await expect(createRouteButton).toBeEnabled();
  await createRouteButton.click();

  await expect(routeSelect).toBeEnabled();
  await expect(routeSelect.locator("option").first()).not.toHaveText("No routes");
  await expect(routeNameInput).toBeEnabled();
  await expect(addPointButton).toBeEnabled();
  await expect(deleteRouteButton).toBeEnabled();

  await deleteRouteButton.click();
  await expect(page.locator("#builder-v2-route-delete-modal")).toBeVisible();
  await page.locator("#builder-v2-route-delete-confirm").click();
  await expect(page.locator("#builder-v2-route-delete-modal")).toHaveCount(0);

  await expect(routeSelect).toBeDisabled();
  await expect(routeSelect.locator("option").first()).toHaveText("No routes");

  await page.locator("#builder-inspector-tab-object").click();
  await expect(page.locator("#builder-inspector-tab-object")).toHaveAttribute("aria-selected", "true");
  await page.locator("#builder-inspector-tab-route").click();
  await expect(page.locator("#builder-inspector-tab-route")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#builder-route-mode-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(createRouteButton).toBeEnabled();

  expect(
    pageErrors,
    "No uncaught browser page errors should occur during the v2 route workflow regression flow."
  ).toHaveLength(0);
});
