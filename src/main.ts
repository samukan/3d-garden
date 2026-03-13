import "./style.css";

import { activeAppRoute, buildAppHref, navigateToRoute } from "./appMode";
import { parseBuilderLayoutDocument, serializeBuilderLayout } from "./builder/sceneLayoutSerializer";
import { createSceneBuilder } from "./builder/sceneBuilder";
import { initEngine } from "./engine/initEngine";
import { registerCoreShaders } from "./engine/registerCoreShaders";
import { createBuilderPanel } from "./ui/builderPanel";
import { createMenuPanel } from "./ui/menuPanel";
import { createStatusBar } from "./ui/statusBar";
import {
  consumeSavedWorldStoreNotice,
  deleteSavedWorld,
  getSavedWorld,
  listSavedWorlds,
  saveSavedWorld
} from "./storage/savedWorldStore";
import { saveViewerDraft } from "./storage/viewerDraftStore";
import { browserDebugError, logBrowserDebug } from "./utils/browserDebug";
import { bootstrapViewerMode } from "./viewer/bootstrapViewerMode";

const EMPTY_LAYOUT_JSON = serializeBuilderLayout([]);

function mergeNotice(...messages: Array<string | null | undefined>): string | null {
  const merged = messages
    .map((message) => message?.trim())
    .filter((message): message is string => Boolean(message))
    .join(" ");
  return merged || null;
}

function formatWorldDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function bootstrap(): Promise<void> {
  logBrowserDebug("bootstrap:start");
  registerCoreShaders();

  const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
  const statusElement = document.querySelector<HTMLElement>("#status-badge");
  const menuPanelElement = document.querySelector<HTMLElement>("#menu-panel");
  const builderWorkspace = document.querySelector<HTMLElement>("#builder-workspace");
  const viewerPanelElement = document.querySelector<HTMLElement>("#viewer-panel");
  const navActionsElement = document.querySelector<HTMLElement>("#app-nav-actions");
  const editLinkElement = document.querySelector<HTMLAnchorElement>("#app-edit-link");
  const menuLinkElement = document.querySelector<HTMLAnchorElement>("#app-menu-link");
  const infoToggleButton = document.querySelector<HTMLButtonElement>("#builder-info-toggle");
  const appElement = document.querySelector<HTMLElement>("#app");
  const brandCardElement = document.querySelector<HTMLElement>(".brand-card");
  const appEyebrow = document.querySelector<HTMLElement>("#app-eyebrow");
  const appTitle = document.querySelector<HTMLElement>("#app-title");
  const appCopy = document.querySelector<HTMLElement>("#app-copy");

  if (!canvas || !statusElement || !menuPanelElement || !builderWorkspace || !viewerPanelElement || !navActionsElement || !editLinkElement || !menuLinkElement || !infoToggleButton || !appElement || !brandCardElement || !appEyebrow || !appTitle || !appCopy) {
    throw new Error("Skill Garden could not find the required DOM elements.");
  }

  let isInfoPanelOpen = true;

  const setInfoPanelState = (nextOpen: boolean): void => {
    isInfoPanelOpen = nextOpen;
    brandCardElement.hidden = !nextOpen;
    infoToggleButton.setAttribute("aria-expanded", String(nextOpen));
  };

  infoToggleButton.addEventListener("click", () => {
    setInfoPanelState(!isInfoPanelOpen);
  });

  const renderMenuMode = (notice: string | null): void => {
    appElement.dataset.appMode = "menu";
    appEyebrow.textContent = "Main Menu";
    appTitle.textContent = "Skill Garden";
    appCopy.textContent = "Open a browser-saved world in read-only mode, or start a new build when you want to create something fresh.";

    canvas.hidden = true;
    statusElement.hidden = true;
    navActionsElement.hidden = true;
    editLinkElement.hidden = true;
    menuLinkElement.hidden = true;
    infoToggleButton.hidden = true;
    setInfoPanelState(true);
    builderWorkspace.hidden = true;
    viewerPanelElement.hidden = true;

    const getMenuState = (nextNotice: string | null) => {
      const worlds = listSavedWorlds();
      const storeNotice = consumeSavedWorldStoreNotice();
      return {
        notice: mergeNotice(nextNotice, storeNotice),
        worlds
      };
    };

    const menuPanel = createMenuPanel(menuPanelElement, {
      onBuildNew: () => {
        navigateToRoute({ mode: "builder" });
      },
      onDeleteWorld: (worldId) => {
        const world = getSavedWorld(worldId);
        if (!world) {
          menuPanel.setState(getMenuState("That saved world no longer exists."));
          return;
        }

        const confirmed = window.confirm(`Delete \"${world.name}\"? This cannot be undone.`);
        if (!confirmed) {
          return;
        }

        deleteSavedWorld(worldId);
        menuPanel.setState(getMenuState(`Deleted ${world.name}.`));
      },
      onEditWorld: (worldId) => {
        navigateToRoute({ mode: "builder", worldId });
      },
      onViewWorld: (worldId) => {
        navigateToRoute({ mode: "viewer", worldId });
      },
      onOpenWorldJsonInViewer: async ({ fileName, content }) => {
        const parsedLayout = parseBuilderLayoutDocument(content);
        if (!parsedLayout.success) {
          return {
            success: false,
            error: `${fileName} could not be opened: ${parsedLayout.error}`
          };
        }

        const nextName = fileName.replace(/\.json$/i, "").trim() || "Imported World";
        const draft = saveViewerDraft({
          layout: content,
          name: nextName,
          objectCount: parsedLayout.value.objects.length
        });

        navigateToRoute({ mode: "viewer", worldJsonId: draft.id });
        return { success: true };
      },
      state: {
        ...getMenuState(notice)
      }
    });

    menuPanelElement.hidden = false;
  };

  if (activeAppRoute.mode === "menu") {
    renderMenuMode(activeAppRoute.notice);
    return;
  }

  let savedWorld = activeAppRoute.mode === "builder" && activeAppRoute.worldId
    ? getSavedWorld(activeAppRoute.worldId)
    : null;
  if (activeAppRoute.mode === "builder" && activeAppRoute.worldId && !savedWorld) {
    renderMenuMode("That saved world could not be found.");
    return;
  }

  if (savedWorld) {
    const parsedWorld = parseBuilderLayoutDocument(savedWorld.layout);
    if (!parsedWorld.success) {
      renderMenuMode(`Saved world could not be opened: ${parsedWorld.error}`);
      return;
    }
  }

  const statusBar = createStatusBar(statusElement);
  logBrowserDebug("bootstrap:dom-ready", {
    appMode: activeAppRoute.mode,
    worldId: activeAppRoute.worldId,
    worldJsonId: activeAppRoute.worldJsonId
  });

  const { engine, renderer } = await initEngine(canvas);
  statusBar.setRenderer(renderer);
  logBrowserDebug("bootstrap:engine-ready", {
    renderer
  });

  appElement.dataset.appMode = activeAppRoute.mode;
  canvas.hidden = false;
  menuPanelElement.hidden = true;
  statusElement.hidden = false;
  navActionsElement.hidden = true;
  brandCardElement.hidden = false;
  infoToggleButton.hidden = true;
  viewerPanelElement.hidden = true;

  let sceneToRender: { render: () => void };

  if (activeAppRoute.mode === "builder") {
    logBrowserDebug("bootstrap:mode", {
      appMode: "builder"
    });

    appEyebrow.textContent = "Development Tool";
    appTitle.textContent = "Skill Garden Builder";
    appCopy.textContent = "Internal scene layout tool for selecting assets, placing them, and editing the current selection.";

    navActionsElement.hidden = true;
    editLinkElement.hidden = true;
    menuLinkElement.hidden = true;
    infoToggleButton.hidden = false;
    setInfoPanelState(false);
    builderWorkspace.hidden = false;
    viewerPanelElement.hidden = true;
    menuPanelElement.hidden = true;
    const builderController = await createSceneBuilder({
      canvas,
      engine
    });

    let currentWorldId = savedWorld?.id ?? null;
    let currentWorldName = savedWorld?.name ?? "";
    let lastSavedLayout = savedWorld?.layout ?? EMPTY_LAYOUT_JSON;
    let persistenceMessage = savedWorld
      ? `Loaded ${savedWorld.name}.`
      : "New world. Save it when you are ready to reopen it later.";

    if (savedWorld) {
      await builderController.importLayout(savedWorld.layout, { recordHistory: false });
    }

    const hasUnsavedChanges = (): boolean => builderController.exportLayout() !== lastSavedLayout;

    const builderPanel = createBuilderPanel(builderWorkspace, builderController, {
      onBackToMenu: () => {
        if (hasUnsavedChanges()) {
          const confirmed = window.confirm("You have unsaved changes. Return to the menu anyway?");
          if (!confirmed) {
            return;
          }
        }

        navigateToRoute({ mode: "menu" });
      },
      onSave: (worldName) => {
        try {
          const savedRecord = saveSavedWorld({
            layout: builderController.exportLayout(),
            name: worldName || currentWorldName || "Untitled World",
            worldId: currentWorldId
          });

          currentWorldId = savedRecord.id;
          currentWorldName = savedRecord.name;
          savedWorld = savedRecord;
          lastSavedLayout = savedRecord.layout;
          persistenceMessage = `Saved ${savedRecord.name} at ${formatWorldDate(savedRecord.updatedAt)}.`;
          builderPanel.setWorldState({
            currentWorldId,
            currentWorldName,
            hasSavedWorld: true,
            isDirty: hasUnsavedChanges(),
            persistenceMessage
          });

          const nextHref = buildAppHref({ mode: "builder", worldId: currentWorldId });
          window.history.replaceState(null, "", nextHref);
        } catch (error) {
          persistenceMessage = error instanceof Error ? error.message : "World could not be saved.";
          builderPanel.setWorldState({
            currentWorldId,
            currentWorldName,
            hasSavedWorld: Boolean(currentWorldId),
            isDirty: hasUnsavedChanges(),
            persistenceMessage
          });
        }
      },
      onSaveAs: (worldName) => {
        try {
          const savedRecord = saveSavedWorld({
            layout: builderController.exportLayout(),
            name: worldName || currentWorldName || "Untitled World"
          });

          currentWorldId = savedRecord.id;
          currentWorldName = savedRecord.name;
          savedWorld = savedRecord;
          lastSavedLayout = savedRecord.layout;
          persistenceMessage = `Saved a new copy as ${savedRecord.name}.`;
          builderPanel.setWorldState({
            currentWorldId,
            currentWorldName,
            hasSavedWorld: true,
            isDirty: hasUnsavedChanges(),
            persistenceMessage
          });

          const nextHref = buildAppHref({ mode: "builder", worldId: currentWorldId });
          window.history.replaceState(null, "", nextHref);
        } catch (error) {
          persistenceMessage = error instanceof Error ? error.message : "World copy could not be saved.";
          builderPanel.setWorldState({
            currentWorldId,
            currentWorldName,
            hasSavedWorld: Boolean(currentWorldId),
            isDirty: hasUnsavedChanges(),
            persistenceMessage
          });
        }
      },
      onViewWorld: () => {
        if (!currentWorldId) {
          return;
        }

        if (hasUnsavedChanges()) {
          const confirmed = window.confirm("Open the last saved version in view mode? Unsaved builder changes will not be included.");
          if (!confirmed) {
            return;
          }
        }

        navigateToRoute({ mode: "viewer", worldId: currentWorldId });
      },
      worldState: {
        currentWorldId,
        currentWorldName,
        hasSavedWorld: Boolean(currentWorldId),
        isDirty: hasUnsavedChanges(),
        persistenceMessage
      }
    });

    const syncBuilderWorldState = (): void => {
      builderPanel.setWorldState({
        currentWorldId,
        currentWorldName,
        hasSavedWorld: Boolean(currentWorldId),
        isDirty: hasUnsavedChanges(),
        persistenceMessage
      });
    };

    builderController.subscribe(() => {
      syncBuilderWorldState();
    });

    window.addEventListener("beforeunload", (event) => {
      if (!hasUnsavedChanges()) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    });

    sceneToRender = builderController.scene;
  } else if (activeAppRoute.mode === "viewer") {
    logBrowserDebug("bootstrap:mode", {
      appMode: "viewer"
    });

    builderWorkspace.hidden = true;
    menuPanelElement.hidden = true;
    navActionsElement.hidden = false;
    menuLinkElement.hidden = false;
    brandCardElement.hidden = true;
    infoToggleButton.hidden = true;
    setInfoPanelState(false);
    viewerPanelElement.hidden = false;

    const viewerController = await bootstrapViewerMode({
      canvas,
      engine,
      route: activeAppRoute,
      formatWorldDate,
      elements: {
        appEyebrow,
        appTitle,
        appCopy,
        editLinkElement,
        menuLinkElement,
        viewerPanelElement
      }
    });

    sceneToRender = viewerController.scene;
  } else {
    renderMenuMode("That app mode is no longer available.");
    return;
  }

  logBrowserDebug("bootstrap:scene-ready", {
    appMode: activeAppRoute.mode
  });

  let lastFpsRefresh = 0;

  engine.runRenderLoop(() => {
    sceneToRender.render();

    const now = performance.now();
    if (now - lastFpsRefresh > 250) {
      lastFpsRefresh = now;
      statusBar.setFps(engine.getFps());
    }
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });

  logBrowserDebug("bootstrap:complete", {
    renderer,
    appMode: activeAppRoute.mode
  });
}

bootstrap().catch((error: unknown) => {
  const brandCard = document.querySelector<HTMLElement>(".brand-card");
  if (brandCard) {
    brandCard.innerHTML = `
      <p class="eyebrow">Startup error</p>
      <h1>Skill Garden could not boot</h1>
      <p>Check the console for details.</p>
    `;
  }

  browserDebugError("bootstrap:error", error);
  console.error(error);
});
