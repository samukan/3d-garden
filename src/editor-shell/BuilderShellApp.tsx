import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";

import { DEFAULT_UPLOADED_ASSET_CATEGORY } from "../generation/natureKitAssetManifest";
import type {
  BuilderDockSide,
  BuilderShellStoreState
} from "./builderShellStore";
import { createBuilderShellStore } from "./builderShellStore";
import type { SceneBuilderAdapter } from "./sceneBuilderAdapter";
import { isBrowserDebugEnabled, logBrowserDebug } from "../utils/browserDebug";

interface BuilderShellHosts {
  libraryPanel: HTMLElement;
  inspectorPanel: HTMLElement;
  toastHost: HTMLElement;
  workspace: HTMLElement;
}

interface BuilderShellAppProps {
  adapter: SceneBuilderAdapter;
  hosts: BuilderShellHosts;
}

type MarqueeSelectionMode = "replace" | "add" | "toggle";

interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PendingRouteDelete {
  routeId: string;
  routeName: string;
}

const MARQUEE_DRAG_THRESHOLD_PX = 6;
const DEFAULT_ROUTE_DURATION_MS = 7000;
const DEFAULT_ROUTE_SPEED = 3;

function createMarqueeRect(startX: number, startY: number, endX: number, endY: number): MarqueeRect {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function BuilderShellApp({ adapter, hosts }: BuilderShellAppProps) {
  const store = useMemo(() => createBuilderShellStore(adapter), [adapter]);

  useEffect(() => {
    const unsubscribeAdapter = adapter.subscribe(() => {
      store.getState().refreshFromAdapter();
    });
    store.getState().refreshFromAdapter();

    return () => {
      unsubscribeAdapter();
    };
  }, [adapter, store]);

  useEffect(() => {
    const handleShortcutKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const state = store.getState();
      const key = event.key.toLowerCase();
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (isModifierPressed && key === "z" && !event.shiftKey) {
        event.preventDefault();
        void state.undo();
        return;
      }

      if ((isModifierPressed && key === "z" && event.shiftKey) || (isModifierPressed && key === "y")) {
        event.preventDefault();
        void state.redo();
        return;
      }

      if (key === "c") {
        event.preventDefault();
        state.toggleCameraNavigation();
        return;
      }

      if (key === "1") {
        event.preventDefault();
        state.setTransformMode("move");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        state.setTransformMode("rotate");
        return;
      }

      if (key === "3") {
        event.preventDefault();
        state.setTransformMode("scale");
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        state.clearSceneSelection();
      }
    };

    window.addEventListener("keydown", handleShortcutKeyDown);
    return () => {
      window.removeEventListener("keydown", handleShortcutKeyDown);
    };
  }, [store]);

  const snapshot = useStore(store, (state: BuilderShellStoreState) => state.snapshot);
  const routeEditState = useStore(store, (state: BuilderShellStoreState) => state.routeEditState);
  const selectedAssetId = useStore(store, (state: BuilderShellStoreState) => state.selectedAssetId);
  const worldState = useStore(store, (state: BuilderShellStoreState) => state.worldState);
  const worldNameDraft = useStore(store, (state: BuilderShellStoreState) => state.worldNameDraft);
  const transformMode = useStore(store, (state: BuilderShellStoreState) => state.transformMode);
  const cameraNavigationEnabled = useStore(store, (state: BuilderShellStoreState) => state.cameraNavigationEnabled);
  const statusNotice = useStore(store, (state: BuilderShellStoreState) => state.statusNotice);
  const uploadInputValueKey = useStore(store, (state: BuilderShellStoreState) => state.uploadInputValueKey);
  const dockLayout = useStore(store, (state: BuilderShellStoreState) => state.dockLayout);

  const saveButtonLabel = worldState.hasSavedWorld ? "Save Changes" : "Save New";
  const compactWorldState = worldState.isDirty ? "Unsaved" : worldState.hasSavedWorld ? "Saved" : "New";
  const worldStatusTitle = `${worldState.persistenceMessage}${worldState.isDirty ? " Unsaved changes." : ""}`.trim();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const marqueeInteractionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    mode: MarqueeSelectionMode;
    isDragging: boolean;
  } | null>(null);
  const toolbarOverflowRef = useRef<HTMLDivElement | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSourceFilter, setAssetSourceFilter] = useState<"all" | "built-in" | "uploaded">("all");
  const [assetSortMode, setAssetSortMode] = useState<"label-asc" | "label-desc" | "recent-upload">("label-asc");
  const [toolbarOverflowOpen, setToolbarOverflowOpen] = useState(false);
  const [uploadCategoryDraft, setUploadCategoryDraft] = useState(DEFAULT_UPLOADED_ASSET_CATEGORY);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [pendingRouteDelete, setPendingRouteDelete] = useState<PendingRouteDelete | null>(null);
  const [routeNameDraft, setRouteNameDraft] = useState("");
  const [routeTimingValueDraft, setRouteTimingValueDraft] = useState("");
  const [newPointDwellDraft, setNewPointDwellDraft] = useState("0");
  const [selectedPointDwellDraft, setSelectedPointDwellDraft] = useState("0");

  const filteredPalette = useMemo(() => {
    const query = assetSearchQuery.trim().toLowerCase();

    const matchesQuery = (label: string): boolean => {
      if (!query) {
        return true;
      }

      return label.toLowerCase().includes(query);
    };

    const matchesSource = (sourceType: "built-in" | "uploaded"): boolean => {
      if (assetSourceFilter === "all") {
        return true;
      }

      return sourceType === assetSourceFilter;
    };

    const filtered = snapshot.palette.filter((item) => matchesSource(item.sourceType) && matchesQuery(item.label));

    if (assetSortMode === "label-desc") {
      return filtered.sort((left, right) => right.label.localeCompare(left.label));
    }

    if (assetSortMode === "recent-upload") {
      return filtered.sort((left, right) => {
        const leftTimestamp = left.uploadedAt ? Date.parse(left.uploadedAt) : 0;
        const rightTimestamp = right.uploadedAt ? Date.parse(right.uploadedAt) : 0;
        const leftSafeTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
        const rightSafeTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;
        return rightSafeTimestamp - leftSafeTimestamp || left.label.localeCompare(right.label);
      });
    }

    return filtered.sort((left, right) => left.label.localeCompare(right.label));
  }, [assetSearchQuery, assetSourceFilter, assetSortMode, snapshot.palette]);

  const selectedPaletteItem = useMemo(
    () => snapshot.palette.find((item) => item.assetId === selectedAssetId) ?? null,
    [selectedAssetId, snapshot.palette]
  );
  const selectedObjectIds = snapshot.selectedObjectIds;
  const primarySelectedObject = snapshot.primarySelectedObject ?? snapshot.selectedObject;
  const selectedObjectCount = selectedObjectIds.length;
  const routeModeEnabled = routeEditState.routeModeEnabled;
  const selectedRoute = routeEditState.routes.find((route) => route.id === routeEditState.selectedRouteId) ?? null;
  const selectedRoutePoint = selectedRoute && routeEditState.selectedPointIndex !== null
    ? selectedRoute.points[routeEditState.selectedPointIndex] ?? null
    : null;
  const hasRoutes = routeEditState.routes.length > 0;
  const hasSelection = Boolean(primarySelectedObject);
  const hasMultipleSelection = selectedObjectCount > 1;
  const leftTab = dockLayout.activeLeftTab;
  const inspectorTab = dockLayout.activeInspectorTab;
  const isUploadModalOpen = pendingUploadFiles.length > 0;

  useEffect(() => {
    if (!selectedRoute) {
      setRouteNameDraft("");
      setRouteTimingValueDraft("");
      return;
    }

    setRouteNameDraft(selectedRoute.name);
    if (selectedRoute.timing.mode === "duration") {
      setRouteTimingValueDraft(String(Math.round(selectedRoute.timing.totalDurationMs)));
      return;
    }

    setRouteTimingValueDraft(selectedRoute.timing.unitsPerSecond.toFixed(2));
  }, [selectedRoute?.id, selectedRoute?.name, selectedRoute?.timing]);

  useEffect(() => {
    setSelectedPointDwellDraft(String(Math.max(0, Math.round(selectedRoutePoint?.dwellMs ?? 0))));
  }, [selectedRoute?.id, routeEditState.selectedPointIndex, selectedRoutePoint?.dwellMs]);

  useEffect(() => {
    const workspace = hosts.workspace;
    workspace.style.setProperty("--builder-v2-left-width", `${dockLayout.leftWidth}px`);
    workspace.style.setProperty("--builder-v2-right-width", `${dockLayout.rightWidth}px`);
    workspace.classList.toggle("is-v2-left-collapsed", dockLayout.leftCollapsed);
    workspace.classList.toggle("is-v2-right-collapsed", dockLayout.rightCollapsed);
    workspace.dataset.v2Density = dockLayout.density;
  }, [dockLayout, hosts.workspace]);

  useEffect(() => {
    if (!toolbarOverflowOpen) {
      return;
    }

    const handleWindowPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (toolbarOverflowRef.current?.contains(target)) {
        return;
      }

      setToolbarOverflowOpen(false);
    };

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setToolbarOverflowOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [toolbarOverflowOpen]);

  useEffect(() => {
    if (!isUploadModalOpen && !pendingRouteDelete) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      if (isUploadModalOpen) {
        closeUploadModal();
      }
      if (pendingRouteDelete) {
        cancelRouteDelete();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [isUploadModalOpen, pendingRouteDelete]);

  useEffect(() => {
    const debugMarquee = (event: string, details: Record<string, unknown>): void => {
      if (!isBrowserDebugEnabled()) {
        return;
      }

      logBrowserDebug(`builder:marquee:${event}`, details);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        debugMarquee("pointerdown-ignored", {
          reason: "non-primary-button",
          button: event.button
        });
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLCanvasElement) || target.id !== "renderCanvas") {
        debugMarquee("pointerdown-ignored", {
          reason: "non-render-canvas-target",
          targetTag: target instanceof Element ? target.tagName : typeof target
        });
        return;
      }

      if (cameraNavigationEnabled) {
        debugMarquee("pointerdown-ignored", {
          reason: "camera-navigation-enabled"
        });
        return;
      }

      const canStart = adapter.canStartMarqueeSelectionAt(event.clientX, event.clientY);
      if (!canStart) {
        debugMarquee("pointerdown-ignored", {
          reason: "runtime-start-gate-denied",
          clientX: event.clientX,
          clientY: event.clientY,
          defaultPrevented: event.defaultPrevented
        });
        return;
      }

      const mode: MarqueeSelectionMode = event.ctrlKey || event.metaKey
        ? "toggle"
        : event.shiftKey
          ? "add"
          : "replace";

      marqueeInteractionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        mode,
        isDragging: false
      };

      if (target.setPointerCapture) {
        target.setPointerCapture(event.pointerId);
      }

      debugMarquee("pointerdown-accepted", {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        defaultPrevented: event.defaultPrevented,
        mode
      });
    };

    const handlePointerMove = (event: PointerEvent): void => {
      const interaction = marqueeInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      interaction.currentX = event.clientX;
      interaction.currentY = event.clientY;

      const deltaX = interaction.currentX - interaction.startX;
      const deltaY = interaction.currentY - interaction.startY;
      if (!interaction.isDragging) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < MARQUEE_DRAG_THRESHOLD_PX) {
          return;
        }

        interaction.isDragging = true;
        debugMarquee("drag-started", {
          pointerId: interaction.pointerId,
          startX: interaction.startX,
          startY: interaction.startY,
          currentX: interaction.currentX,
          currentY: interaction.currentY,
          threshold: MARQUEE_DRAG_THRESHOLD_PX
        });
      }

      debugMarquee("drag-updated", {
        pointerId: interaction.pointerId,
        currentX: interaction.currentX,
        currentY: interaction.currentY
      });
      setMarqueeRect(createMarqueeRect(interaction.startX, interaction.startY, interaction.currentX, interaction.currentY));
    };

    const handlePointerRelease = (event: PointerEvent): void => {
      const interaction = marqueeInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      marqueeInteractionRef.current = null;

      if (interaction.isDragging) {
        const normalizedRect = createMarqueeRect(
          interaction.startX,
          interaction.startY,
          interaction.currentX,
          interaction.currentY
        );

        adapter.applyMarqueeSelection(
          {
            left: normalizedRect.left,
            top: normalizedRect.top,
            right: normalizedRect.left + normalizedRect.width,
            bottom: normalizedRect.top + normalizedRect.height
          },
          interaction.mode
        );

        debugMarquee("drag-released", {
          pointerId: interaction.pointerId,
          mode: interaction.mode,
          left: normalizedRect.left,
          top: normalizedRect.top,
          right: normalizedRect.left + normalizedRect.width,
          bottom: normalizedRect.top + normalizedRect.height
        });
      } else {
        debugMarquee("pointerup-without-drag", {
          pointerId: interaction.pointerId,
          startX: interaction.startX,
          startY: interaction.startY,
          endX: interaction.currentX,
          endY: interaction.currentY
        });
      }

      const target = event.target;
      if (target instanceof HTMLCanvasElement && target.id === "renderCanvas" && target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }

      setMarqueeRect(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerRelease);
    window.addEventListener("pointercancel", handlePointerRelease);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerRelease);
      window.removeEventListener("pointercancel", handlePointerRelease);
      marqueeInteractionRef.current = null;
      setMarqueeRect(null);
    };
  }, [adapter, cameraNavigationEnabled]);

  const handleUploadClick = (): void => {
    uploadInputRef.current?.click();
  };

  const handleUploadInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setPendingUploadFiles(files);
    setUploadCategoryDraft(DEFAULT_UPLOADED_ASSET_CATEGORY);
    event.target.value = "";
  };

  const closeUploadModal = (): void => {
    setPendingUploadFiles([]);
    setUploadCategoryDraft(DEFAULT_UPLOADED_ASSET_CATEGORY);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  const confirmUploadModal = (): void => {
    if (pendingUploadFiles.length === 0) {
      closeUploadModal();
      return;
    }

    void store.getState().uploadAssets(pendingUploadFiles, uploadCategoryDraft).finally(() => {
      closeUploadModal();
    });
  };

  const applyRouteNameDraft = (): void => {
    if (!selectedRoute) {
      return;
    }

    const nextName = routeNameDraft.trim();
    if (!nextName || nextName === selectedRoute.name) {
      setRouteNameDraft(selectedRoute.name);
      return;
    }

    store.getState().updateRouteSettings({ name: nextName });
  };

  const applyRouteTimingDraft = (): void => {
    if (!selectedRoute) {
      return;
    }

    const numericValue = Number(routeTimingValueDraft);
    if (!Number.isFinite(numericValue)) {
      if (selectedRoute.timing.mode === "duration") {
        setRouteTimingValueDraft(String(Math.round(selectedRoute.timing.totalDurationMs)));
      } else {
        setRouteTimingValueDraft(selectedRoute.timing.unitsPerSecond.toFixed(2));
      }
      return;
    }

    if (selectedRoute.timing.mode === "duration") {
      store.getState().updateRouteSettings({
        timing: {
          mode: "duration",
          totalDurationMs: Math.max(0, Math.round(numericValue))
        }
      });
      return;
    }

    store.getState().updateRouteSettings({
      timing: {
        mode: "speed",
        unitsPerSecond: Math.max(0.1, Number(numericValue.toFixed(3)))
      }
    });
  };

  const applySelectedPointDwellDraft = (): void => {
    if (!selectedRoutePoint) {
      return;
    }

    const dwellMs = Number(selectedPointDwellDraft);
    if (!Number.isFinite(dwellMs)) {
      setSelectedPointDwellDraft(String(Math.max(0, Math.round(selectedRoutePoint.dwellMs ?? 0))));
      return;
    }

    store.getState().updateSelectedRoutePointDwellMs(Math.max(0, Math.round(dwellMs)));
  };

  const beginDockResize = (side: BuilderDockSide, event: ReactPointerEvent<HTMLDivElement>): void => {
    if (window.matchMedia("(max-width: 980px)").matches) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = side === "left" ? dockLayout.leftWidth : dockLayout.rightWidth;

    handle.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = side === "left" ? startWidth + deltaX : startWidth - deltaX;
      store.getState().setDockWidth(side, nextWidth);
    };

    const finish = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const requestRouteDelete = (): void => {
    if (!selectedRoute) {
      return;
    }

    setPendingRouteDelete({
      routeId: selectedRoute.id,
      routeName: selectedRoute.name
    });
  };

  const cancelRouteDelete = (): void => {
    setPendingRouteDelete(null);
  };

  const confirmRouteDelete = (): void => {
    if (!pendingRouteDelete) {
      return;
    }

    store.getState().selectRoute(pendingRouteDelete.routeId);
    store.getState().deleteSelectedRoute();
    setPendingRouteDelete(null);
  };

  const toolbar = (
    <div className="builder-top-bar-main builder-v2-toolbar-main">
      <div className="builder-toolbar-zone builder-toolbar-zone-world">
        <span className="builder-toolbar-zone-label">World</span>
        <label className="builder-field builder-top-bar-field">
          <span className="builder-visually-hidden">World name</span>
          <input
            id="builder-world-name"
            type="text"
            maxLength={80}
            placeholder="World name"
            aria-label="World name"
            value={worldNameDraft}
            onChange={(event) => {
              store.getState().setWorldNameDraft(event.target.value);
            }}
          />
        </label>
        <button id="builder-save-world" className="ui-button builder-button builder-button-primary" type="button" onClick={() => {
          store.getState().saveWorld();
        }}>{saveButtonLabel}</button>
        <button id="builder-save-world-as" className="ui-button builder-button" type="button" onClick={() => {
          store.getState().saveWorldAs();
        }}>Save As</button>
        <button id="builder-view-world" className="ui-button builder-button" type="button" disabled={!worldState.hasSavedWorld} onClick={() => {
          store.getState().viewWorld();
        }}>View</button>
      </div>
      <div className="builder-toolbar-zone builder-toolbar-zone-edit">
        <span className="builder-toolbar-zone-label">Edit</span>
        <button id="builder-undo" className="ui-button builder-button" type="button" title="Undo (Ctrl/Cmd+Z)" onClick={() => {
          void store.getState().undo();
        }}>Undo</button>
        <button id="builder-redo" className="ui-button builder-button" type="button" title="Redo (Ctrl/Cmd+Shift+Z)" onClick={() => {
          void store.getState().redo();
        }}>Redo</button>
        <div className="builder-transform-mode-group" role="group" aria-label="Transform mode">
          {(["move", "rotate", "scale"] as const).map((mode) => {
            const isActive = mode === transformMode;
            return (
              <button
                key={mode}
                id={`builder-transform-mode-${mode}`}
                className={`ui-button builder-button builder-transform-mode-button${isActive ? " builder-button-primary is-active" : ""}`}
                type="button"
                data-transform-mode={mode}
                aria-pressed={isActive}
                disabled={routeModeEnabled}
                onClick={() => {
                  store.getState().setTransformMode(mode);
                }}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="builder-toolbar-zone builder-toolbar-zone-mode">
        <span className="builder-toolbar-zone-label">Mode</span>
        <button
          id="builder-camera-nav-toggle"
          className={`ui-button builder-button builder-button-camera${cameraNavigationEnabled ? " builder-button-primary" : ""}`}
          type="button"
          aria-pressed={cameraNavigationEnabled}
          onClick={() => {
            store.getState().toggleCameraNavigation();
          }}
        >
          {cameraNavigationEnabled ? "Camera Nav" : "Object Edit"}
        </button>
        <button
          id="builder-route-mode-toggle"
          className={`ui-button builder-button${routeModeEnabled ? " builder-button-primary" : ""}`}
          type="button"
          aria-pressed={routeModeEnabled}
          onClick={() => {
            const actions = store.getState();
            if (!routeModeEnabled) {
              actions.setActiveInspectorTab("route");
            }
            actions.toggleRouteMode();
          }}
        >
          {routeModeEnabled ? "Route On" : "Route Off"}
        </button>
      </div>
      <div ref={toolbarOverflowRef} className="builder-toolbar-zone builder-toolbar-zone-overflow">
        <span className="builder-toolbar-zone-label">More</span>
        <button
          id="builder-toolbar-overflow-toggle"
          className="ui-button builder-button builder-toolbar-overflow-trigger"
          type="button"
          aria-expanded={toolbarOverflowOpen}
          onClick={() => {
            setToolbarOverflowOpen((current) => !current);
          }}
        >
          More
        </button>
        {toolbarOverflowOpen ? (
          <div className="builder-toolbar-overflow-menu" role="menu" aria-label="Builder tools">
            <button id="builder-toolbar-download-world-package" className="ui-button builder-button builder-button-block" type="button" onClick={() => {
              setToolbarOverflowOpen(false);
              void store.getState().downloadWorldPackage();
            }}>Download .sgw</button>
            <button id="builder-toolbar-download-world-json" className="ui-button builder-button builder-button-block" type="button" onClick={() => {
              setToolbarOverflowOpen(false);
              store.getState().downloadWorldJson();
            }}>Download .json</button>
            <button id="builder-toolbar-upload-asset" className="ui-button builder-button builder-button-block" type="button" onClick={() => {
              setToolbarOverflowOpen(false);
              handleUploadClick();
            }}>Upload Assets</button>
            <button id="builder-back-to-menu" className="ui-button builder-button builder-button-block" type="button" onClick={() => {
              setToolbarOverflowOpen(false);
              store.getState().backToMenu();
            }}>Back To Menu</button>
            <div className="builder-toolbar-density-group">
              <span className="builder-panel-label">Density</span>
              <div className="builder-action-row builder-action-row-split">
                <button
                  className={`ui-button builder-button${dockLayout.density === "comfortable" ? " builder-button-primary" : ""}`}
                  type="button"
                  onClick={() => {
                    store.getState().setDockDensity("comfortable");
                  }}
                >
                  Comfortable
                </button>
                <button
                  className={`ui-button builder-button${dockLayout.density === "compact" ? " builder-button-primary" : ""}`}
                  type="button"
                  onClick={() => {
                    store.getState().setDockDensity("compact");
                  }}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <input
          key={uploadInputValueKey}
          id="builder-upload-asset-input"
          ref={uploadInputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          multiple
          hidden
          onChange={handleUploadInputChange}
        />
        <p id="builder-world-status" className="builder-status builder-world-status" aria-live="polite" title={worldStatusTitle}>{compactWorldState}</p>
      </div>
    </div>
  );

  const leftPanel = (
    <>
      <div className="builder-panel-header builder-pane-header">
        <p className="builder-panel-kicker">Library</p>
        <h2>Assets & Hierarchy</h2>
        <p className="builder-panel-copy">Browse assets and manage scene objects from one dock.</p>
      </div>
      <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-library-tools">
        <div className="builder-panel-tabs builder-pane-mode-tabs" role="tablist" aria-label="Builder left panel tabs">
          <button
            id="builder-tab-assets"
            className={`builder-tab${leftTab === "assets" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={leftTab === "assets"}
            aria-controls="builder-assets-panel"
            data-builder-tab="assets"
            onClick={() => {
              store.getState().setActiveLeftTab("assets");
            }}
          >
            Assets
          </button>
          <button
            id="builder-tab-scene"
            className={`builder-tab${leftTab === "hierarchy" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={leftTab === "hierarchy"}
            aria-controls="builder-scene-panel"
            data-builder-tab="scene"
            onClick={() => {
              store.getState().setActiveLeftTab("hierarchy");
            }}
          >
            Hierarchy
          </button>
        </div>
      </div>
      <div id="builder-assets-panel" className={`builder-tab-panel builder-pane-surface builder-pane-surface-assets builder-assets-pane-layout${leftTab === "assets" ? " is-active" : ""}`} role="tabpanel" hidden={leftTab !== "assets"}>
        <div className="builder-assets-pane-top">
          <div className="builder-pane-subheader">
            <p className="builder-panel-label">Assets</p>
            <button id="builder-upload-asset" className="ui-button builder-button" type="button" onClick={handleUploadClick}>Upload</button>
          </div>
          <div className="builder-asset-browser-controls">
            <label className="builder-field builder-asset-search-row">
              <span>Search</span>
              <input
                id="builder-asset-search"
                type="search"
                placeholder="Filter assets"
                value={assetSearchQuery}
                onChange={(event) => {
                  setAssetSearchQuery(event.target.value);
                }}
              />
            </label>
            <div className="builder-asset-filter-row">
              <label className="builder-field">
                <span>Source</span>
                <select
                  id="builder-asset-source-filter"
                  className="builder-select"
                  value={assetSourceFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all" || value === "built-in" || value === "uploaded") {
                      setAssetSourceFilter(value);
                    }
                  }}
                >
                  <option value="all">All</option>
                  <option value="built-in">Built-in</option>
                  <option value="uploaded">Uploaded</option>
                </select>
              </label>
              <label className="builder-field">
                <span>Sort</span>
                <select
                  id="builder-asset-sort"
                  className="builder-select"
                  value={assetSortMode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "label-asc" || value === "label-desc" || value === "recent-upload") {
                      setAssetSortMode(value);
                    }
                  }}
                >
                  <option value="label-asc">Name A-Z</option>
                  <option value="label-desc">Name Z-A</option>
                  <option value="recent-upload">Recent Uploads</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="builder-assets-pane-list-region">
          <div id="builder-palette">
            {filteredPalette.length === 0 ? (
              <div className="builder-editor-hint" role="status">
                <p className="builder-selection-title">No matching assets</p>
                <p className="builder-selection-meta">Adjust search/filter or upload a .glb asset.</p>
              </div>
            ) : (
              <div className="builder-palette-group builder-asset-pane-list" data-palette-group="all">
                <p className="builder-palette-group-title">Asset Library ({filteredPalette.length})</p>
                <div className="builder-palette-group-items">
                  {filteredPalette.map((item) => {
                    const isSelected = item.assetId === selectedAssetId;
                    return (
                      <button
                        key={item.assetId}
                        className={`builder-palette-item${isSelected ? " is-selected" : ""}`}
                        type="button"
                        data-asset-id={item.assetId}
                        aria-pressed={isSelected}
                        onClick={() => {
                          store.getState().setSelectedAsset(item.assetId);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="builder-assets-pane-footer builder-panel-section builder-panel-section-tight builder-asset-selection-inline">
          {selectedPaletteItem ? (
            <>
              <p className="builder-panel-label">Selected Asset</p>
              <p className="builder-selection-title">{selectedPaletteItem.label}</p>
              <p className="builder-selection-meta">{selectedPaletteItem.sourceType === "uploaded" ? "Uploaded" : "Built-in"}</p>
              <button
                id="builder-place-asset"
                className="ui-button builder-button builder-button-primary builder-button-block"
                type="button"
                disabled={!snapshot.isReady || !selectedAssetId || routeModeEnabled}
                onClick={() => {
                  void store.getState().placeSelectedAsset();
                }}
              >
                Add to scene
              </button>
            </>
          ) : (
            <div className="builder-editor-hint" role="status">
              <p className="builder-selection-title">No asset selected</p>
              <p className="builder-selection-meta">Select an asset to place it in the scene.</p>
            </div>
          )}
        </div>
      </div>
      <div id="builder-scene-panel" className={`builder-tab-panel builder-pane-surface builder-pane-surface-hierarchy${leftTab === "hierarchy" ? " is-active" : ""}`} role="tabpanel" hidden={leftTab !== "hierarchy"}>
        <div className="builder-pane-subheader">
          <p className="builder-panel-label">Hierarchy</p>
          <p className="builder-pane-subheader-meta">{snapshot.objects.length} object{snapshot.objects.length === 1 ? "" : "s"}</p>
        </div>
        <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-fill">
          <div id="builder-scene-objects" className="builder-scene-object-list">
            {snapshot.objects.length === 0 ? (
              <div className="builder-editor-hint" role="status">
                <p className="builder-selection-title">Hierarchy is empty</p>
                <p className="builder-selection-meta">Add an asset to create the first scene object.</p>
              </div>
            ) : (
              snapshot.objects.map((object) => {
                const isSelected = selectedObjectIds.includes(object.id);
                const isPrimarySelected = object.id === snapshot.primarySelectedObjectId;
                return (
                  <button
                    key={object.id}
                    className={`builder-scene-object-item${isSelected ? " is-selected" : ""}${isPrimarySelected ? " is-primary" : ""}`}
                    type="button"
                    data-object-id={object.id}
                    aria-current={isPrimarySelected ? "true" : undefined}
                    title={isPrimarySelected ? "Primary selection" : undefined}
                    onClick={(event) => {
                      if (routeModeEnabled) {
                        return;
                      }

                      store.getState().selectObjectWithModifiers(object.id, {
                        additive: event.shiftKey,
                        toggle: event.ctrlKey || event.metaKey
                      });
                    }}
                  >
                    {object.assetLabel}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );

  const inspectorPanel = (
    <>
      <div className="builder-panel-header builder-pane-header">
        <p className="builder-panel-kicker">Inspector</p>
        <h2>Object & Route Inspector</h2>
        <p className="builder-panel-copy">Switch between object editing and route authoring without leaving the dock.</p>
      </div>
      <div className="builder-panel-section builder-panel-section-tight builder-inspector-section">
        <div className="builder-panel-tabs builder-inspector-mode-tabs" role="tablist" aria-label="Inspector mode">
          <button
            id="builder-inspector-tab-object"
            className={`builder-tab${inspectorTab === "object" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={inspectorTab === "object"}
            aria-controls="builder-inspector-object-panel"
            onClick={() => {
              store.getState().setActiveInspectorTab("object");
            }}
          >
            Object Inspector
          </button>
          <button
            id="builder-inspector-tab-route"
            className={`builder-tab${inspectorTab === "route" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={inspectorTab === "route"}
            aria-controls="builder-inspector-route-panel"
            onClick={() => {
              store.getState().setActiveInspectorTab("route");
            }}
          >
            Route Inspector
          </button>
        </div>
      </div>
      <section id="builder-inspector-route-panel" className="builder-inspector-tab-panel" role="tabpanel" aria-labelledby="builder-inspector-tab-route" hidden={inspectorTab !== "route"}>
        <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-inspector-section builder-camera-routes">
          <div className="builder-pane-subheader">
            <span className="builder-panel-label">Camera Routes</span>
            <span className={`builder-mode-chip${routeModeEnabled ? " is-active" : ""}`}>
              {routeModeEnabled ? "Route mode active" : "Route mode off"}
            </span>
          </div>
          <p className="builder-selection-meta">
            {routeModeEnabled
              ? "Create and manage camera paths for this scene."
              : "Enable Route Mode in the top toolbar to create and edit routes."}
          </p>
          <div className="builder-action-row builder-action-row-split">
            <button
              id="builder-v2-route-create"
              className="ui-button builder-button builder-button-block"
              type="button"
              disabled={!routeModeEnabled}
              onClick={() => {
                store.getState().createRoute();
              }}
            >
              Create Route
            </button>
          </div>
          <label className="builder-field">
            <span>Selected Route</span>
            <select
              id="builder-v2-route-select"
              className="builder-select"
              value={routeEditState.selectedRouteId ?? ""}
              disabled={!routeModeEnabled || !hasRoutes}
              onChange={(event) => {
                const nextRouteId = event.target.value.trim() || null;
                store.getState().selectRoute(nextRouteId);
              }}
            >
              {hasRoutes
                ? routeEditState.routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.name}</option>
                ))
                : <option value="">No routes</option>}
            </select>
          </label>
          <label className="builder-field">
            <span>Default Route</span>
            <select
              id="builder-v2-route-default-select"
              className="builder-select"
              value={routeEditState.defaultRouteId ?? ""}
              disabled={!routeModeEnabled || !hasRoutes}
              onChange={(event) => {
                const nextDefaultRouteId = event.target.value.trim() || null;
                store.getState().setDefaultRoute(nextDefaultRouteId);
              }}
            >
              <option value="">No default route</option>
              {routeEditState.routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </label>
          <label className="builder-field">
            <span>Route Name</span>
            <input
              id="builder-v2-route-name"
              type="text"
              maxLength={80}
              value={routeNameDraft}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                setRouteNameDraft(event.target.value);
              }}
              onBlur={() => {
                applyRouteNameDraft();
              }}
            />
          </label>
          <label className="builder-field builder-field-inline">
            <span>Loop route</span>
            <input
              type="checkbox"
              checked={selectedRoute?.loop ?? false}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                store.getState().updateRouteSettings({ loop: event.target.checked });
              }}
            />
          </label>
          <label className="builder-field">
            <span>Easing</span>
            <select
              className="builder-select"
              value={selectedRoute?.easing ?? "easeInOutSine"}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                const nextEasing = event.target.value === "linear" ? "linear" : "easeInOutSine";
                store.getState().updateRouteSettings({ easing: nextEasing });
              }}
            >
              <option value="easeInOutSine">easeInOutSine</option>
              <option value="linear">linear</option>
            </select>
          </label>
          <label className="builder-field">
            <span>Timing Mode</span>
            <select
              className="builder-select"
              value={selectedRoute?.timing.mode ?? "duration"}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                if (!selectedRoute) {
                  return;
                }

                if (event.target.value === "speed") {
                  const nextSpeed = selectedRoute.timing.mode === "speed"
                    ? selectedRoute.timing.unitsPerSecond
                    : DEFAULT_ROUTE_SPEED;
                  store.getState().updateRouteSettings({
                    timing: {
                      mode: "speed",
                      unitsPerSecond: Math.max(0.1, Number(nextSpeed.toFixed(3)))
                    }
                  });
                  return;
                }

                const nextDuration = selectedRoute.timing.mode === "duration"
                  ? selectedRoute.timing.totalDurationMs
                  : DEFAULT_ROUTE_DURATION_MS;
                store.getState().updateRouteSettings({
                  timing: {
                    mode: "duration",
                    totalDurationMs: Math.max(0, Math.round(nextDuration))
                  }
                });
              }}
            >
              <option value="duration">Duration</option>
              <option value="speed">Speed</option>
            </select>
          </label>
          <label className="builder-field">
            <span>{selectedRoute?.timing.mode === "speed" ? "Speed (units/s)" : "Duration (ms)"}</span>
            <input
              type="number"
              min={selectedRoute?.timing.mode === "speed" ? "0.1" : "0"}
              step={selectedRoute?.timing.mode === "speed" ? "0.1" : "100"}
              value={routeTimingValueDraft}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                setRouteTimingValueDraft(event.target.value);
              }}
              onBlur={() => {
                applyRouteTimingDraft();
              }}
            />
          </label>
          <label className="builder-field">
            <span>New Point Dwell (ms)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={newPointDwellDraft}
              disabled={!routeModeEnabled || !selectedRoute}
              onChange={(event) => {
                setNewPointDwellDraft(event.target.value);
              }}
            />
          </label>
          <div className="builder-action-row builder-action-row-split">
            <button
              id="builder-v2-route-add-point"
              className="ui-button builder-button builder-button-block"
              type="button"
              disabled={!routeModeEnabled || !selectedRoute}
              onClick={() => {
                const dwellMs = Number(newPointDwellDraft);
                const sanitizedDwellMs = Number.isFinite(dwellMs) ? Math.max(0, Math.round(dwellMs)) : 0;
                store.getState().addRoutePointFromCurrentCamera(sanitizedDwellMs);
              }}
            >
              Add Current Camera Point
            </button>
            <button
              className="ui-button builder-button builder-button-block"
              type="button"
              disabled={!routeModeEnabled || !selectedRoutePoint}
              onClick={() => {
                store.getState().updateSelectedRoutePointFromCurrentCamera();
              }}
            >
              Update Selected Point
            </button>
          </div>
          <div className="builder-action-row builder-action-row-split">
            <button
              id="builder-v2-route-delete"
              className="ui-button builder-button builder-button-danger builder-button-block"
              type="button"
              disabled={!routeModeEnabled || !selectedRoute}
              onClick={() => {
                requestRouteDelete();
              }}
            >
              Delete Route
            </button>
          </div>
          <label className="builder-field">
            <span>Selected Point Dwell (ms)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={selectedPointDwellDraft}
              disabled={!routeModeEnabled || !selectedRoutePoint}
              onChange={(event) => {
                setSelectedPointDwellDraft(event.target.value);
              }}
              onBlur={() => {
                applySelectedPointDwellDraft();
              }}
            />
          </label>
          <div className="builder-route-points">
            {!routeModeEnabled ? (
              <div className="builder-empty-state">
                <p className="builder-selection-title">Route mode is off</p>
                <p className="builder-selection-meta">Enable Route Mode from the top toolbar to edit points.</p>
              </div>
            ) : !selectedRoute ? (
              <div className="builder-empty-state">
                <p className="builder-selection-title">No route selected</p>
                <p className="builder-selection-meta">Create or select a route to edit its points.</p>
              </div>
            ) : selectedRoute.points.length === 0 ? (
              <div className="builder-empty-state">
                <p className="builder-selection-title">No points yet</p>
                <p className="builder-selection-meta">Move the camera and add points to build the route.</p>
              </div>
            ) : (
              selectedRoute.points.map((point, index) => {
                const isSelected = routeEditState.selectedPointIndex === index;
                const canMoveUp = index > 0;
                const canMoveDown = index < selectedRoute.points.length - 1;

                return (
                  <div key={`${selectedRoute.id}-point-${index}`} className={`builder-route-point-item${isSelected ? " is-selected" : ""}`}>
                    <div className="builder-route-point-header">
                      <button
                        className="ui-button builder-button builder-route-point-select"
                        type="button"
                        onClick={() => {
                          store.getState().selectRoutePoint(index);
                        }}
                      >
                        Point {index + 1}
                      </button>
                      <span className="builder-route-point-meta">Dwell: {Math.max(0, Math.round(point.dwellMs ?? 0))}ms</span>
                    </div>
                    <p className="builder-route-point-value"><strong>Position:</strong> {point.position.map((value) => Number(value.toFixed(2))).join(", ")}</p>
                    <p className="builder-route-point-value"><strong>LookAt:</strong> {point.lookAt.map((value) => Number(value.toFixed(2))).join(", ")}</p>
                    <div className="builder-route-point-actions">
                      <button
                        className="ui-button builder-button"
                        type="button"
                        disabled={!canMoveUp}
                        onClick={() => {
                          const actions = store.getState();
                          actions.selectRoutePoint(index);
                          actions.moveSelectedRoutePoint("up");
                        }}
                      >
                        Move Up
                      </button>
                      <button
                        className="ui-button builder-button"
                        type="button"
                        disabled={!canMoveDown}
                        onClick={() => {
                          const actions = store.getState();
                          actions.selectRoutePoint(index);
                          actions.moveSelectedRoutePoint("down");
                        }}
                      >
                        Move Down
                      </button>
                      <button
                        className="ui-button builder-button builder-button-danger"
                        type="button"
                        onClick={() => {
                          const actions = store.getState();
                          actions.selectRoutePoint(index);
                          actions.deleteSelectedRoutePoint();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="builder-action-row builder-action-row-split">
            <button
              className="ui-button builder-button builder-button-block"
              type="button"
              disabled={!routeModeEnabled || !selectedRoute || selectedRoute.points.length < 2 || routeEditState.isPreviewPlaying}
              onClick={() => {
                store.getState().previewSelectedRoute();
              }}
            >
              Preview Route
            </button>
            <button
              className="ui-button builder-button builder-button-block"
              type="button"
              disabled={!routeModeEnabled || !routeEditState.isPreviewPlaying}
              onClick={() => {
                store.getState().stopRoutePreview({ resetToStart: true });
              }}
            >
              Stop Preview
            </button>
          </div>
        </div>
      </section>
      <section id="builder-inspector-object-panel" className="builder-inspector-tab-panel" role="tabpanel" aria-labelledby="builder-inspector-tab-object" hidden={inspectorTab !== "object"}>
        <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Object</span>
        <div id="builder-selection-summary" className="builder-selection-summary">
          {routeModeEnabled ? (
            <div className="builder-editor-hint" role="status">
              <p className="builder-selection-title">Route mode active</p>
              <p className="builder-selection-meta">Object editing actions are temporarily disabled while editing routes.</p>
            </div>
          ) : null}
          {hasMultipleSelection && primarySelectedObject ? (
            <div className="builder-selection-card">
              <p className="builder-selection-title">{selectedObjectCount} objects selected</p>
              <p className="builder-selection-meta">Primary: {primarySelectedObject.assetLabel}</p>
              <p className="builder-selection-meta">{primarySelectedObject.id}</p>
              <p className="builder-selection-meta">Transform fields show primary values. Transform edits and nudge/rotate actions apply to all selected objects.</p>
            </div>
          ) : primarySelectedObject ? (
            <div className="builder-selection-card">
              <p className="builder-selection-title">{primarySelectedObject.assetLabel}</p>
              <p className="builder-selection-meta">{primarySelectedObject.id}</p>
              <p className="builder-selection-meta">{primarySelectedObject.assetId}</p>
            </div>
          ) : (
            <div className="builder-editor-hint" role="status">
              <p className="builder-selection-title">No object selected</p>
              <p className="builder-selection-meta">Select from Hierarchy or click an object in the viewport to inspect properties.</p>
              <p className="builder-selection-meta">Placed objects: {snapshot.objects.length}</p>
            </div>
          )}
        </div>
      </div>
      <div className="builder-panel-section builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Transform</span>
        <div className="builder-property-grid">
          <label className="builder-property-row">
            <span className="builder-property-label">Position X</span>
            <input
              id="builder-pos-x"
              type="number"
              step="0.1"
              disabled={!hasSelection || routeModeEnabled}
              value={primarySelectedObject ? primarySelectedObject.position.x : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { x: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Position Y</span>
            <input
              id="builder-pos-y"
              type="number"
              step="0.1"
              disabled={!hasSelection || routeModeEnabled}
              value={primarySelectedObject ? primarySelectedObject.position.y : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { y: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Position Z</span>
            <input
              id="builder-pos-z"
              type="number"
              step="0.1"
              disabled={!hasSelection || routeModeEnabled}
              value={primarySelectedObject ? primarySelectedObject.position.z : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { z: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Rotation Y</span>
            <input
              id="builder-rot-y"
              type="number"
              step="0.1"
              disabled={!hasSelection || routeModeEnabled}
              value={primarySelectedObject ? primarySelectedObject.rotationY : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ rotationY: value });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Scale</span>
            <input
              id="builder-scale"
              type="number"
              min="0.1"
              step="0.1"
              disabled={!hasSelection || routeModeEnabled}
              value={primarySelectedObject ? primarySelectedObject.scale : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ scale: value });
                }
              }}
            />
          </label>
        </div>
        <div className="builder-action-row builder-action-row-split builder-inspector-utility-row">
          <button
            className="ui-button builder-button"
            type="button"
            data-move-axis="x"
            data-move-delta="-0.25"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              store.getState().nudgeSelectedObject("x", -0.25);
            }}
          >
            Nudge X-
          </button>
          <button
            className="ui-button builder-button"
            type="button"
            data-move-axis="x"
            data-move-delta="0.25"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              store.getState().nudgeSelectedObject("x", 0.25);
            }}
          >
            Nudge X+
          </button>
        </div>
        <div className="builder-action-row builder-action-row-split builder-inspector-utility-row">
          <button
            className="ui-button builder-button"
            type="button"
            data-rotate-delta="-15"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              store.getState().rotateSelectedObject(-15);
            }}
          >
            Rotate -15
          </button>
          <button
            className="ui-button builder-button"
            type="button"
            data-rotate-delta="15"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              store.getState().rotateSelectedObject(15);
            }}
          >
            Rotate +15
          </button>
        </div>
      </div>
      <div className="builder-panel-section builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Actions</span>
        <div className="builder-action-row builder-action-row-split builder-inspector-actions-row">
          <button
            id="builder-duplicate"
            className="ui-button builder-button"
            type="button"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              void store.getState().duplicateSelectedObject();
            }}
          >
            Duplicate
          </button>
          <button
            id="builder-delete"
            className="ui-button builder-button builder-button-danger"
            type="button"
            disabled={!hasSelection || routeModeEnabled}
            onClick={() => {
              store.getState().deleteSelectedObject();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <p id="builder-status" className="builder-status">{snapshot.statusMessage}</p>
      </section>
    </>
  );

  const toast = statusNotice ? (
    <div className="builder-toast builder-toast-info" role="status">
      <span>{statusNotice}</span>
      <button className="builder-toast-close" type="button" aria-label="Dismiss notification" onClick={() => {
        store.getState().clearStatusNotice();
      }}>x</button>
    </div>
  ) : null;

  const workspaceChrome = (
    <>
      <button
        className={`ui-button builder-button builder-v2-dock-toggle builder-v2-dock-toggle-left${dockLayout.leftCollapsed ? " is-collapsed" : ""}`}
        type="button"
        aria-expanded={!dockLayout.leftCollapsed}
        aria-controls="builder-library-panel"
        onClick={() => {
          store.getState().toggleDockCollapsed("left");
        }}
      >
        {dockLayout.leftCollapsed ? "Show Library" : "Hide Library"}
      </button>
      <button
        className={`ui-button builder-button builder-v2-dock-toggle builder-v2-dock-toggle-right${dockLayout.rightCollapsed ? " is-collapsed" : ""}${toolbarOverflowOpen ? " is-hidden-for-overflow-menu" : ""}`}
        type="button"
        aria-expanded={!dockLayout.rightCollapsed}
        aria-controls="builder-inspector-panel"
        onClick={() => {
          store.getState().toggleDockCollapsed("right");
        }}
      >
        {dockLayout.rightCollapsed ? "Show Inspector" : "Hide Inspector"}
      </button>
      {!dockLayout.leftCollapsed ? (
        <div className="builder-v2-dock-resize builder-v2-dock-resize-left" onPointerDown={(event) => {
          beginDockResize("left", event);
        }} />
      ) : null}
      {!dockLayout.rightCollapsed ? (
        <div className="builder-v2-dock-resize builder-v2-dock-resize-right" onPointerDown={(event) => {
          beginDockResize("right", event);
        }} />
      ) : null}
    </>
  );

  const uploadModal = isUploadModalOpen ? (
    <div className="builder-shell-modal-backdrop" role="presentation">
      <div className="builder-shell-modal" role="dialog" aria-modal="true" aria-labelledby="builder-upload-modal-title">
        <p id="builder-upload-modal-title" className="builder-shell-modal-title">Upload Assets</p>
        <p className="builder-shell-modal-copy">{pendingUploadFiles.length} file{pendingUploadFiles.length === 1 ? "" : "s"} selected.</p>
        <label className="builder-field">
          <span>Category</span>
          <input
            id="builder-upload-category-input"
            type="text"
            value={uploadCategoryDraft}
            onChange={(event) => {
              setUploadCategoryDraft(event.target.value);
            }}
          />
        </label>
        <div className="builder-shell-modal-actions">
          <button className="ui-button builder-button" type="button" onClick={closeUploadModal}>Cancel</button>
          <button className="ui-button builder-button builder-button-primary" type="button" onClick={confirmUploadModal}>Upload</button>
        </div>
      </div>
    </div>
  ) : null;

  const routeDeleteModal = pendingRouteDelete ? (
    <div className="builder-shell-modal-backdrop" role="presentation">
      <div id="builder-v2-route-delete-modal" className="builder-shell-modal" role="dialog" aria-modal="true" aria-labelledby="builder-delete-route-modal-title">
        <p id="builder-delete-route-modal-title" className="builder-shell-modal-title">Delete Route</p>
        <p className="builder-shell-modal-copy">Delete route "{pendingRouteDelete.routeName}"?</p>
        <div className="builder-shell-modal-actions">
          <button id="builder-v2-route-delete-cancel" className="ui-button builder-button" type="button" onClick={cancelRouteDelete}>Cancel</button>
          <button id="builder-v2-route-delete-confirm" className="ui-button builder-button builder-button-danger" type="button" onClick={confirmRouteDelete}>Delete</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {toolbar}
      {marqueeRect ? (
        <div
          className="builder-marquee-overlay"
          style={{
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`
          }}
          aria-hidden="true"
        />
      ) : null}
      {uploadModal}
      {routeDeleteModal}
      {createPortal(leftPanel, hosts.libraryPanel)}
      {createPortal(inspectorPanel, hosts.inspectorPanel)}
      {createPortal(toast, hosts.toastHost)}
      {createPortal(workspaceChrome, hosts.workspace)}
    </>
  );
}
