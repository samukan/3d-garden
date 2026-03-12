import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners, normalizeInlineText } from "./browserDebugTestUtils";

function extractFirstObjectLayout(exportedLayout: string): {
  id: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
} {
  const parsed = JSON.parse(exportedLayout) as {
    objects: Array<{
      id: string;
      position: { x: number; y: number; z: number };
      rotationY: number;
    }>;
  };

  const firstObject = parsed.objects[0];
  if (!firstObject) {
    throw new Error("Expected at least one exported object.");
  }

  return firstObject;
}

test("boots builder mode and supports basic layout actions", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#renderCanvas")).toBeVisible();
  await expect(page.locator("#builder-workspace")).toBeVisible();
  await expect(page.locator("#app-nav-actions")).toBeVisible();
  await expect(page.locator("#app-edit-link")).toBeHidden();
  await expect(page.locator("#app-menu-link")).toBeVisible();
  await expect(page.locator("#app-menu-link")).toHaveText("Back To Menu");
  const libraryPanel = page.locator("#builder-library-panel");
  const resizeHandle = page.locator("#builder-resize-handle");

  await expect(libraryPanel).toBeVisible();
  await expect(page.locator("#builder-inspector-panel")).toBeVisible();
  await expect(resizeHandle).toBeVisible();
  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });
  await expect(page.locator("#builder-selection-summary")).toContainText("No object selected");

  const libraryBoundsBefore = await libraryPanel.boundingBox();
  const resizeBounds = await resizeHandle.boundingBox();
  expect(libraryBoundsBefore).not.toBeNull();
  expect(resizeBounds).not.toBeNull();

  if (!libraryBoundsBefore || !resizeBounds) {
    throw new Error("Builder resize controls did not render with measurable bounds.");
  }

  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2, resizeBounds.y + resizeBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2 + 48, resizeBounds.y + resizeBounds.height / 2);
  await page.mouse.up();

  const libraryBoundsAfter = await libraryPanel.boundingBox();
  expect(libraryBoundsAfter).not.toBeNull();

  if (!libraryBoundsAfter) {
    throw new Error("Builder library panel could not be measured after resize.");
  }

  expect(libraryBoundsAfter.width).toBeGreaterThan(libraryBoundsBefore.width + 20);

  const firstPaletteButton = page.locator("#builder-palette button").first();
  await expect(firstPaletteButton).toBeVisible();
  await firstPaletteButton.click();
  await page.locator("#builder-place-asset").click();
  await page.locator("#builder-place-asset").click();

  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-selection-summary")).not.toContainText("No object selected");
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-");

  await page.locator("#builder-tab-scene").click();
  const sceneObjectRows = page.locator(".builder-scene-object-row");
  await expect(sceneObjectRows).toHaveCount(2);

  await sceneObjectRows.nth(0).locator(".builder-scene-object-select").click();
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-1");

  const posXInput = page.locator("#builder-pos-x");
  const rotYInput = page.locator("#builder-rot-y");
  const posXBefore = Number(await posXInput.inputValue());
  const rotationBefore = Number(await rotYInput.inputValue());

  await page.locator("button[data-move-axis='x'][data-move-delta='0.25']").click();
  await expect(posXInput).toHaveValue((posXBefore + 0.25).toString());

  await page.locator("button[data-rotate-delta='15']").click();
  await expect(rotYInput).toHaveValue((rotationBefore + 15).toString());

  await sceneObjectRows.nth(1).locator(".builder-scene-object-delete").click();
  await expect(sceneObjectRows).toHaveCount(1);

  await page.locator("#builder-export").click();

  const exportedLayout = await page.locator("#builder-layout-json").inputValue();
  expect(exportedLayout).toContain("builder-object-");
  const exportedObject = extractFirstObjectLayout(exportedLayout);
  expect(exportedObject.id).toBe("builder-object-1");
  expect(exportedObject.position.x).toBeCloseTo(posXBefore + 0.25, 5);
  expect(exportedObject.rotationY).toBeCloseTo(rotationBefore + 15, 5);

  const builderStatus = await page.locator("#builder-status").innerText();
  console.log(`[builder:ready] ${normalizeInlineText(builderStatus)}`);

  expect(pageErrors, "No uncaught browser page errors should occur during builder bootstrap.").toHaveLength(0);
});