import type { Engine } from "@babylonjs/core/Engines/engine";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";

import type { AppRoute } from "../appMode";
import { buildAppHref } from "../appMode";
import { createLayoutScene } from "../engine/createLayoutScene";
import { createViewerPanel, type ViewerPanelState } from "../ui/viewerPanel";
import { isBrowserDebugEnabled } from "../utils/browserDebug";
import { resolveViewerWorld } from "./resolveViewerWorld";
import type { ViewerLoadState } from "./viewerTypes";

const EKA_PRESENTATION_WORLD_ID = "16882855-0952-4e80-ae7d-5ff8ccc7f6f2";

interface ViewerModeElements {
  appEyebrow: HTMLElement;
  appTitle: HTMLElement;
  appCopy: HTMLElement;
  editLinkElement: HTMLAnchorElement;
  menuLinkElement: HTMLAnchorElement;
  viewerPanelElement: HTMLElement;
}

export interface ViewerModeController {
  scene: Scene;
  dispose: () => void;
}

export interface BootstrapViewerModeOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
  route: AppRoute;
  elements: ViewerModeElements;
  formatWorldDate: (dateValue: string) => string;
}

function sourceLabel(source: "saved-world" | "json-file"): string {
  return source === "saved-world" ? "Saved World" : "JSON File";
}

function summarizeIssues(messages: string[]): string[] {
  if (messages.length <= 3) {
    return messages;
  }

  return [...messages.slice(0, 3), `${messages.length - 3} more issue(s)...`];
}

function messageForState(loadState: ViewerLoadState, loaded: number, skipped: number): string {
  if (loadState === "loading") {
    return "Loading world objects...";
  }

  if (loadState === "error") {
    return "Viewer could not load this world.";
  }

  if (loadState === "partial") {
    return `Loaded ${loaded} object${loaded === 1 ? "" : "s"}. Skipped ${skipped} object${skipped === 1 ? "" : "s"}.`;
  }

  return `Loaded ${loaded} object${loaded === 1 ? "" : "s"}.`;
}

export async function bootstrapViewerMode(options: BootstrapViewerModeOptions): Promise<ViewerModeController> {
  const { canvas, engine, route, elements, formatWorldDate } = options;
  const { appEyebrow, appTitle, appCopy, editLinkElement, menuLinkElement, viewerPanelElement } = elements;

  appEyebrow.textContent = "World Viewer";
  appTitle.textContent = "Loading world...";
  appCopy.textContent = "Preparing a read-only world preview.";

  menuLinkElement.href = buildAppHref({ mode: "menu" });
  menuLinkElement.textContent = "Back To Menu";
  editLinkElement.hidden = true;
  editLinkElement.removeAttribute("href");
  const devFreeCameraEnabled = isBrowserDebugEnabled();

  let resetView = (): void => {};
  let toggleCameraMode = (): void => {};
  let panelState: ViewerPanelState = {
    loadState: "loading",
    title: "Loading world...",
    sourceLabel: "Saved World",
    objectCount: 0,
    loadedObjectCount: 0,
    skippedObjectCount: 0,
    updatedAtLabel: "Loading...",
    message: messageForState("loading", 0, 0),
    issues: [],
    canResetView: false,
    cameraMode: "presentationOrbit",
    canToggleCameraMode: false
  };

  const viewerPanel = createViewerPanel(viewerPanelElement, {
    onResetView: () => {
      resetView();
    },
    onToggleCameraMode: () => {
      toggleCameraMode();
    },
    state: panelState
  });

  const setViewerPanelState = (nextState: ViewerPanelState): void => {
    panelState = { ...nextState };
    viewerPanel.setState(panelState);
  };

  const patchViewerPanelState = (patch: Partial<ViewerPanelState>): void => {
    setViewerPanelState({
      ...panelState,
      ...patch
    });
  };

  const worldResolution = resolveViewerWorld(route);

  if (!worldResolution.success) {
    appTitle.textContent = "Viewer unavailable";
    appCopy.textContent = worldResolution.error;
    setViewerPanelState({
      loadState: "error",
      title: "Viewer unavailable",
      sourceLabel: "Saved World",
      objectCount: 0,
      loadedObjectCount: 0,
      skippedObjectCount: 0,
      updatedAtLabel: "Unknown",
      message: worldResolution.error,
      issues: [],
      canResetView: false,
      cameraMode: "presentationOrbit",
      canToggleCameraMode: false
    });

    const fallbackScene = await createLayoutScene({
      canvas,
      engine,
      layoutRecords: [],
      enableDevFreeCamera: devFreeCameraEnabled
    });
    resetView = fallbackScene.resetView;
    toggleCameraMode = () => {
      if (!fallbackScene.canUseDevFreeCamera()) {
        return;
      }

      patchViewerPanelState({
        cameraMode: fallbackScene.toggleCameraMode()
      });
    };

    return {
      scene: fallbackScene.scene,
      dispose: () => {
        viewerPanel.dispose();
      }
    };
  }

  const world = worldResolution.world;
  const isEkaPresentationWorld =
    world.source === "saved-world" && world.sourceId === EKA_PRESENTATION_WORLD_ID;
  const atmosphereProfile = isEkaPresentationWorld ? "ekaPresentation" : "default";
  const cameraPresentationProfile = isEkaPresentationWorld ? "ekaShowcase" : "default";

  appTitle.textContent = world.name;
  appCopy.textContent = "Read-only world presentation mode.";

  if (world.editableWorldId) {
    editLinkElement.hidden = false;
    editLinkElement.href = buildAppHref({ mode: "builder", worldId: world.editableWorldId });
    editLinkElement.textContent = "Edit World";
  }

  const initialUpdatedLabel = formatWorldDate(world.updatedAt);
  setViewerPanelState({
    loadState: "loading",
    title: world.name,
    sourceLabel: sourceLabel(world.source),
    objectCount: world.objectCount,
    loadedObjectCount: 0,
    skippedObjectCount: 0,
    updatedAtLabel: initialUpdatedLabel,
    message: messageForState("loading", 0, 0),
    issues: [],
    canResetView: false,
    cameraMode: "presentationOrbit",
    canToggleCameraMode: false
  });

  try {
    const sceneController = await createLayoutScene({
      canvas,
      engine,
      layoutRecords: world.layoutRecords,
      atmosphereProfile,
      cameraPresentationProfile,
      enableDevFreeCamera: devFreeCameraEnabled,
      onCameraModeChange: (cameraMode) => {
        patchViewerPanelState({
          cameraMode
        });
      },
      onProgress: ({ loadedObjectCount, skippedObjectCount }) => {
        patchViewerPanelState({
          loadState: "loading",
          title: world.name,
          sourceLabel: sourceLabel(world.source),
          objectCount: world.objectCount,
          loadedObjectCount,
          skippedObjectCount,
          updatedAtLabel: initialUpdatedLabel,
          message: messageForState("loading", loadedObjectCount, skippedObjectCount),
          issues: [],
          canResetView: false
        });
      }
    });

    resetView = sceneController.resetView;
    toggleCameraMode = () => {
      if (!sceneController.canUseDevFreeCamera()) {
        return;
      }

      sceneController.toggleCameraMode();
    };
    const loadState: ViewerLoadState =
      sceneController.loadIssues.length > 0 ? "partial" : "ready";
    const issues = summarizeIssues(sceneController.loadIssues.map((issue) => issue.message));

    if (world.objectCount === 0) {
      appCopy.textContent = "This world has no objects yet. Return to the builder to add content.";
    } else if (loadState === "partial") {
      appCopy.textContent = messageForState(
        "partial",
        sceneController.loadedObjectCount,
        sceneController.skippedObjectCount
      );
    } else {
      appCopy.textContent = `Loaded ${sceneController.loadedObjectCount} object${
        sceneController.loadedObjectCount === 1 ? "" : "s"
      } for exploration.`;
    }

    setViewerPanelState({
      loadState,
      title: world.name,
      sourceLabel: sourceLabel(world.source),
      objectCount: world.objectCount,
      loadedObjectCount: sceneController.loadedObjectCount,
      skippedObjectCount: sceneController.skippedObjectCount,
      updatedAtLabel: initialUpdatedLabel,
      message: world.objectCount === 0
        ? "This world is empty. You can still move the camera and reset the view."
        : messageForState(
            loadState,
            sceneController.loadedObjectCount,
            sceneController.skippedObjectCount
          ),
      issues,
      canResetView: true,
      cameraMode: sceneController.getCameraMode(),
      canToggleCameraMode: sceneController.canUseDevFreeCamera()
    });

    return {
      scene: sceneController.scene,
      dispose: () => {
        viewerPanel.dispose();
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Viewer could not load this world.";
    appCopy.textContent = message;
    setViewerPanelState({
      loadState: "error",
      title: world.name,
      sourceLabel: sourceLabel(world.source),
      objectCount: world.objectCount,
      loadedObjectCount: 0,
      skippedObjectCount: world.objectCount,
      updatedAtLabel: initialUpdatedLabel,
      message,
      issues: [],
      canResetView: false,
      cameraMode: "presentationOrbit",
      canToggleCameraMode: false
    });

    const fallbackScene = await createLayoutScene({
      canvas,
      engine,
      layoutRecords: [],
      atmosphereProfile,
      cameraPresentationProfile,
      enableDevFreeCamera: devFreeCameraEnabled
    });
    resetView = fallbackScene.resetView;
    toggleCameraMode = () => {
      if (!fallbackScene.canUseDevFreeCamera()) {
        return;
      }

      patchViewerPanelState({
        cameraMode: fallbackScene.toggleCameraMode()
      });
    };

    return {
      scene: fallbackScene.scene,
      dispose: () => {
        viewerPanel.dispose();
      }
    };
  }
}
