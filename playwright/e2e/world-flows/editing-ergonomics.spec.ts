import { expect, test, type Page } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

async function pressUndo(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+KeyZ`);
}

async function pressRedoShift(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+Shift+KeyZ`);
}

async function pressRedoY(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+KeyY`);
}

async function pressDuplicate(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+KeyD`);
}

test("supports undo/redo and editing shortcuts for builder workflows", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette button").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.locator("#builder-tab-scene").click();
  const sceneObjectRows = page.locator(".builder-scene-object-item");
  await expect(sceneObjectRows).toHaveCount(1);

  await pressUndo(page);
  await expect(sceneObjectRows).toHaveCount(0);

  await pressRedoShift(page);
  await expect(sceneObjectRows).toHaveCount(1);

  await sceneObjectRows.first().click();
  await pressDuplicate(page);
  await expect(sceneObjectRows).toHaveCount(2);

  await page.keyboard.press("Delete");
  await expect(sceneObjectRows).toHaveCount(1);

  await pressUndo(page);
  await expect(sceneObjectRows).toHaveCount(2);

  await pressRedoY(page);
  await expect(sceneObjectRows).toHaveCount(1);

  await sceneObjectRows.first().click();
  const posXInput = page.locator("#builder-pos-x");
  const posXBefore = Number(await posXInput.inputValue());
  await page.locator("button[data-move-axis='x'][data-move-delta='0.25']").click();
  const posXAfterMove = Number(await posXInput.inputValue());
  expect(posXAfterMove).toBeCloseTo(posXBefore + 0.25, 5);

  await pressUndo(page);
  const posXAfterUndo = Number(await posXInput.inputValue());
  expect(posXAfterUndo).toBeCloseTo(posXBefore, 5);

  await pressRedoShift(page);
  const posXAfterRedo = Number(await posXInput.inputValue());
  expect(posXAfterRedo).toBeCloseTo(posXAfterMove, 5);

  await page.locator("#builder-advanced-tools-toggle").click();
  await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();
  await page.locator("#builder-export").click();
  const layoutTextarea = page.locator("#builder-layout-json");
  await expect(layoutTextarea).not.toHaveValue("");

  await layoutTextarea.fill("{\"objects\":[]}");
  await page.locator("#builder-import").click();
  await expect(page.locator("#builder-status")).toContainText("Imported 0 object", {
    timeout: 10_000
  });
  await expect(sceneObjectRows).toHaveCount(0);

  await pressUndo(page);
  await expect(sceneObjectRows).toHaveCount(1);

  await pressRedoY(page);
  await expect(sceneObjectRows).toHaveCount(0);

  await pressUndo(page);
  await expect(sceneObjectRows).toHaveCount(1);

  await sceneObjectRows.first().click();
  await expect(page.locator("#builder-selection-summary")).not.toContainText("No object selected");
  await page.keyboard.press("Escape");
  await expect(page.locator("#builder-selection-summary")).toContainText("No object selected");

  await sceneObjectRows.first().click();
  const worldNameInput = page.locator("#builder-world-name");
  await worldNameInput.fill("Focus Guard");
  await worldNameInput.click();
  await worldNameInput.press("Backspace");
  await expect(worldNameInput).toHaveValue("Focus Guar");
  await expect(sceneObjectRows).toHaveCount(1);

  if (!(await page.locator("#builder-advanced-tools-panel").isVisible())) {
    await page.locator("#builder-advanced-tools-toggle").click();
    await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();
  }
  await layoutTextarea.fill("abc");
  await layoutTextarea.click();
  await layoutTextarea.press("Backspace");
  await expect(layoutTextarea).toHaveValue("ab");
  await expect(sceneObjectRows).toHaveCount(1);

  expect(pageErrors, "No uncaught browser page errors should occur during editing ergonomics flow.").toHaveLength(0);
});
