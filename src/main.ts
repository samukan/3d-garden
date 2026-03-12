import "./style.css";

import { activeAppRoute, buildAppHref, navigateToRoute } from "./appMode";
import { parseBuilderLayoutDocument, serializeBuilderLayout } from "./builder/sceneLayoutSerializer";
import { createSceneBuilder } from "./builder/sceneBuilder";
import { createLayoutScene } from "./engine/createLayoutScene";
import { initEngine } from "./engine/initEngine";
import { createBuilderPanel } from "./ui/builderPanel";
import { createMenuPanel } from "./ui/menuPanel";
import { createStatusBar } from "./ui/statusBar";
import { deleteSavedWorld, getSavedWorld, listSavedWorlds, saveSavedWorld } from "./storage/savedWorldStore";
import { browserDebugError, logBrowserDebug } from "./utils/browserDebug";

const EMPTY_LAYOUT_JSON = serializeBuilderLayout([]);

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

  const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
  const statusElement = document.querySelector<HTMLElement>("#status-badge");
  const menuPanelElement = document.querySelector<HTMLElement>("#menu-panel");
  const builderWorkspace = document.querySelector<HTMLElement>("#builder-workspace");
  const navActionsElement = document.querySelector<HTMLElement>("#app-nav-actions");
  const editLinkElement = document.querySelector<HTMLAnchorElement>("#app-edit-link");
  const menuLinkElement = document.querySelector<HTMLAnchorElement>("#app-menu-link");
  const appElement = document.querySelector<HTMLElement>("#app");
  const brandCardElement = document.querySelector<HTMLElement>(".brand-card");
  const appEyebrow = document.querySelector<HTMLElement>("#app-eyebrow");
  const appTitle = document.querySelector<HTMLElement>("#app-title");
  const appCopy = document.querySelector<HTMLElement>("#app-copy");

  if (!canvas || !statusElement || !menuPanelElement || !builderWorkspace || !navActionsElement || !editLinkElement || !menuLinkElement || !appElement || !brandCardElement || !appEyebrow || !appTitle || !appCopy) {
    throw new Error("Skill Garden could not find the required DOM elements.");
  }

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
    brandCardElement.hidden = false;
    builderWorkspace.hidden = true;

    const menuPanel = createMenuPanel(menuPanelElement, {
      onBuildNew: () => {
        navigateToRoute({ mode: "builder" });
      },
      onDeleteWorld: (worldId) => {
        const world = getSavedWorld(worldId);
        if (!world) {
          menuPanel.setState({
            notice: "That saved world no longer exists.",
            worlds: listSavedWorlds()
          });
          return;
        }

        const confirmed = window.confirm(`Delete \"${world.name}\"? This cannot be undone.`);
        if (!confirmed) {
          return;
        }

        deleteSavedWorld(worldId);
        menuPanel.setState({
          notice: `Deleted ${world.name}.`,
          worlds: listSavedWorlds()
        });
      },
      onEditWorld: (worldId) => {
        navigateToRoute({ mode: "builder", worldId });
      },
      onViewWorld: (worldId) => {
        navigateToRoute({ mode: "viewer", worldId });
      },
      state: {
        notice,
        worlds: listSavedWorlds()
      }
    });

    menuPanelElement.hidden = false;
  };

  if (activeAppRoute.mode === "menu") {
    renderMenuMode(activeAppRoute.notice);
    return;
  }

  let savedWorld = activeAppRoute.worldId ? getSavedWorld(activeAppRoute.worldId) : null;
  if ((activeAppRoute.mode === "builder" || activeAppRoute.mode === "viewer") && activeAppRoute.worldId && !savedWorld) {
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
    worldId: activeAppRoute.worldId
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

  let sceneToRender: { render: () => void };

  if (activeAppRoute.mode === "builder") {
    logBrowserDebug("bootstrap:mode", {
      appMode: "builder"
    });

    appEyebrow.textContent = "Development Tool";
    appTitle.textContent = "Skill Garden Builder";
    appCopy.textContent = "Internal scene layout tool for selecting assets, placing them, and editing the current selection.";

    navActionsElement.hidden = false;
    editLinkElement.hidden = true;
    menuLinkElement.hidden = false;
    menuLinkElement.href = buildAppHref({ mode: "menu" });
    menuLinkElement.textContent = "Back To Menu";
    brandCardElement.hidden = false;
    builderWorkspace.hidden = false;
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
      builderController.importLayout(savedWorld.layout);
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

    if (!savedWorld) {
      renderMenuMode("That saved world could not be found.");
      return;
    }

    appEyebrow.textContent = "Saved World Viewer";
    appTitle.textContent = savedWorld.name;
    appCopy.textContent = "Read-only view of a saved builder world. Use Edit to return to the builder for changes.";

    builderWorkspace.hidden = true;
    menuPanelElement.hidden = true;
    navActionsElement.hidden = false;
    editLinkElement.hidden = false;
    menuLinkElement.hidden = false;
    brandCardElement.hidden = false;

    editLinkElement.href = buildAppHref({ mode: "builder", worldId: savedWorld.id });
    menuLinkElement.href = buildAppHref({ mode: "menu" });

    editLinkElement.textContent = "Edit World";
    menuLinkElement.textContent = "Back To Menu";

    appCopy.textContent = `Read-only view of a saved builder world with ${savedWorld.objectCount} object${savedWorld.objectCount === 1 ? "" : "s"}. Updated ${formatWorldDate(savedWorld.updatedAt)}.`;

    const parsedWorld = parseBuilderLayoutDocument(savedWorld.layout);
    if (!parsedWorld.success) {
      renderMenuMode(`Saved world could not be opened: ${parsedWorld.error}`);
      return;
    }

    const viewerController = await createLayoutScene({
      canvas,
      engine,
      layoutRecords: parsedWorld.value.objects
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
