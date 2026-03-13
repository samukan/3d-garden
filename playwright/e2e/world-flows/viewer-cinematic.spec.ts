import { expect, test, type Page } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";
const EKA_PRESENTATION_WORLD_ID = "16882855-0952-4e80-ae7d-5ff8ccc7f6f2";

function captureCinematicEvents(page: Page): string[] {
  const events: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (!text.includes("[browser-debug] viewer-cinematic:")) {
      return;
    }

    events.push(text);
  });
  return events;
}

async function seedSingleWorld(
  page: Page,
  worldId: string,
  name: string
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, seededWorldId, seededWorldName }) => {
      const now = new Date().toISOString();
      const layout = JSON.stringify(
        {
          objects: [
            {
              id: "ground-1",
              assetId: "groundTile",
              position: { x: 0, y: 0, z: 0 },
              rotationY: 0,
              scale: 1
            },
            {
              id: "path-1",
              assetId: "pathStraight",
              position: { x: 2.5, y: 0, z: 0 },
              rotationY: 0,
              scale: 1
            },
            {
              id: "tree-hero",
              assetId: "tree",
              position: { x: 0.8, y: 0, z: 1.2 },
              rotationY: 15,
              scale: 1.4
            },
            {
              id: "tree-background",
              assetId: "tree",
              position: { x: -5, y: 0, z: -3.5 },
              rotationY: -10,
              scale: 0.9
            }
          ]
        },
        null,
        2
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          {
            id: seededWorldId,
            name: seededWorldName,
            layout,
            objectCount: 4,
            createdAt: now,
            updatedAt: now
          }
        ])
      );
    },
    {
      storageKey: SAVED_WORLDS_KEY,
      seededWorldId: worldId,
      seededWorldName: name
    }
  );
}

test("autoplays cinematic for Eka presentation world and completes once", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const cinematicEvents = captureCinematicEvents(page);

  await seedSingleWorld(page, EKA_PRESENTATION_WORLD_ID, "Eka Cinematic Test World");

  await page.goto(
    `${baseURL}/?renderer=webgl&appMode=viewer&worldId=${EKA_PRESENTATION_WORLD_ID}&debugBrowserLogs=1`,
    {
      waitUntil: "domcontentloaded"
    }
  );

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect.poll(
    () =>
      cinematicEvents.find(
        (event) => event.includes("viewer-cinematic:start") && event.includes("preset: microSmallWorld")
      ),
    {
      timeout: 12_000
    }
  ).toBeTruthy();
  await expect.poll(() => cinematicEvents.some((event) => event.includes("viewer-cinematic:complete")), {
    timeout: 8_000
  }).toBe(true);

  const completeEvent = cinematicEvents.find((event) => event.includes("viewer-cinematic:complete"));
  expect(completeEvent).toBeTruthy();
  const finalBetaMatch = completeEvent?.match(/finalBeta:\s*([0-9.]+)/);
  const finalRadiusMatch = completeEvent?.match(/finalRadius:\s*([0-9.]+)/);
  expect(finalBetaMatch).toBeTruthy();
  expect(finalRadiusMatch).toBeTruthy();

  const finalBeta = Number(finalBetaMatch?.[1]);
  const finalRadius = Number(finalRadiusMatch?.[1]);
  expect(finalBeta).toBeGreaterThanOrEqual(1);
  expect(finalBeta).toBeLessThanOrEqual(1.16);
  expect(finalRadius).toBeLessThanOrEqual(13.5);
  expect(cinematicEvents.some((event) => event.includes("viewer-cinematic:cancel"))).toBe(false);

  expect(pageErrors, "No uncaught browser page errors should occur for cinematic autoplay.").toHaveLength(0);
});

test("cancels cinematic on user interaction and keeps viewer responsive", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const cinematicEvents = captureCinematicEvents(page);

  await seedSingleWorld(page, EKA_PRESENTATION_WORLD_ID, "Eka Cinematic Cancel Test");

  await page.goto(
    `${baseURL}/?renderer=webgl&appMode=viewer&worldId=${EKA_PRESENTATION_WORLD_ID}&debugBrowserLogs=1`,
    {
      waitUntil: "domcontentloaded"
    }
  );

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect.poll(
    () =>
      cinematicEvents.find(
        (event) => event.includes("viewer-cinematic:start") && event.includes("preset: microSmallWorld")
      ),
    {
      timeout: 10_000
    }
  ).toBeTruthy();

  await page.locator("#renderCanvas").click({ position: { x: 180, y: 160 } });
  await expect.poll(
    () =>
      cinematicEvents.some(
        (event) => event.includes("viewer-cinematic:cancel") && event.includes("pointerdown")
      ),
    {
      timeout: 10_000
    }
  ).toBe(true);

  await page.keyboard.press("r");
  await expect(page.locator("#viewer-reset-view")).toBeEnabled();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");

  expect(pageErrors, "No uncaught browser page errors should occur during cinematic cancel flow.").toHaveLength(0);
});

test("does not autoplay cinematic for non-target worlds", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const cinematicEvents = captureCinematicEvents(page);
  const nonTargetWorldId = "viewer-cinematic-non-target";

  await seedSingleWorld(page, nonTargetWorldId, "Standard Viewer World");

  await page.goto(
    `${baseURL}/?renderer=webgl&appMode=viewer&worldId=${nonTargetWorldId}&debugBrowserLogs=1`,
    {
      waitUntil: "domcontentloaded"
    }
  );

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await page.waitForTimeout(2_000);
  expect(cinematicEvents.some((event) => event.includes("viewer-cinematic:start"))).toBe(false);

  expect(pageErrors, "No uncaught browser page errors should occur for non-target world viewer.").toHaveLength(0);
});
