import { createStore } from "zustand/vanilla";

import type {
  BuilderRouteEditState,
  BuilderRoutePointMoveDirection,
  BuilderRouteSettingsPatch,
  BuilderSceneSnapshot
} from "../builder/builderTypes";
import { DEFAULT_UPLOADED_ASSET_CATEGORY, type AssetId } from "../generation/natureKitAssetManifest";
import type { BuilderPanelWorldState } from "../ui/builderPanel";
import type { SceneBuilderAdapter } from "./sceneBuilderAdapter";

export type BuilderDockSide = "left" | "right";
export type BuilderLeftTab = "assets" | "hierarchy";
export type BuilderInspectorTab = "object" | "route";
export type BuilderDockDensity = "comfortable" | "compact";

export interface BuilderDockLayoutState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  activeLeftTab: BuilderLeftTab;
  activeInspectorTab: BuilderInspectorTab;
  density: BuilderDockDensity;
}

interface BuilderShellState {
  snapshot: BuilderSceneSnapshot;
  routeEditState: BuilderRouteEditState;
  selectedAssetId: AssetId | null;
  worldState: BuilderPanelWorldState;
  worldNameDraft: string;
  transformMode: "move" | "rotate" | "scale";
  cameraNavigationEnabled: boolean;
  statusNotice: string | null;
  uploadInputValueKey: number;
  dockLayout: BuilderDockLayoutState;
}

interface BuilderShellActions {
  refreshFromAdapter: () => void;
  setSelectedAsset: (assetId: AssetId | null) => void;
  setActiveLeftTab: (tab: BuilderLeftTab) => void;
  setActiveInspectorTab: (tab: BuilderInspectorTab) => void;
  setDockCollapsed: (side: BuilderDockSide, collapsed: boolean) => void;
  toggleDockCollapsed: (side: BuilderDockSide) => void;
  setDockWidth: (side: BuilderDockSide, width: number) => void;
  setDockDensity: (density: BuilderDockDensity) => void;
  setWorldNameDraft: (value: string) => void;
  saveWorld: () => void;
  saveWorldAs: () => void;
  viewWorld: () => void;
  backToMenu: () => void;
  setTransformMode: (mode: "move" | "rotate" | "scale") => void;
  toggleCameraNavigation: () => void;
  toggleRouteMode: () => void;
  createRoute: (name?: string) => string | null;
  selectRoute: (routeId: string | null) => void;
  deleteSelectedRoute: () => boolean;
  setDefaultRoute: (routeId: string | null) => void;
  addRoutePointFromCurrentCamera: (dwellMs?: number) => boolean;
  updateRouteSettings: (patch: BuilderRouteSettingsPatch) => boolean;
  previewSelectedRoute: () => boolean;
  stopRoutePreview: (options?: { resetToStart?: boolean }) => void;
  selectRoutePoint: (pointIndex: number | null) => void;
  deleteSelectedRoutePoint: () => boolean;
  moveSelectedRoutePoint: (direction: BuilderRoutePointMoveDirection) => boolean;
  updateSelectedRoutePointFromCurrentCamera: () => boolean;
  updateSelectedRoutePointDwellMs: (dwellMs: number) => boolean;
  placeSelectedAsset: () => Promise<void>;
  selectObjectById: (objectId: string | null) => void;
  selectObjectWithModifiers: (objectId: string, options?: { additive?: boolean; toggle?: boolean }) => void;
  clearSceneSelection: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  uploadAssets: (files: File[], category: string) => Promise<void>;
  updateSelectedTransform: (patch: {
    position?: { x?: number; y?: number; z?: number };
    rotationY?: number;
    scale?: number;
  }) => void;
  nudgeSelectedObject: (axis: "x" | "y" | "z", delta: number) => void;
  rotateSelectedObject: (delta: number) => void;
  deleteSelectedObject: () => void;
  duplicateSelectedObject: () => Promise<void>;
  clearStatusNotice: () => void;
}

export type BuilderShellStoreState = BuilderShellState & BuilderShellActions;

function resolveSelectedAsset(snapshot: BuilderSceneSnapshot, selectedAssetId: AssetId | null): AssetId | null {
  const paletteAssetIds = new Set(snapshot.palette.map((item) => item.assetId));
  if (selectedAssetId && paletteAssetIds.has(selectedAssetId)) {
    return selectedAssetId;
  }

  return snapshot.palette[0]?.assetId ?? null;
}

const V2_DOCK_LAYOUT_STORAGE_KEY = "skill-garden.builder-v2.dock-layout.v1";
const MIN_DOCK_WIDTH_PX = 220;
const MAX_LEFT_DOCK_WIDTH_PX = 520;
const MAX_RIGHT_DOCK_WIDTH_PX = 560;

const DEFAULT_DOCK_LAYOUT_STATE: BuilderDockLayoutState = {
  leftWidth: 300,
  rightWidth: 340,
  leftCollapsed: false,
  rightCollapsed: false,
  activeLeftTab: "assets",
  activeInspectorTab: "object",
  density: "comfortable"
};

function clampDockWidth(side: BuilderDockSide, width: number): number {
  const maxWidth = side === "left" ? MAX_LEFT_DOCK_WIDTH_PX : MAX_RIGHT_DOCK_WIDTH_PX;
  return Math.min(maxWidth, Math.max(MIN_DOCK_WIDTH_PX, Math.round(width)));
}

function parseDockLayoutState(value: unknown): BuilderDockLayoutState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<BuilderDockLayoutState>;
  const activeLeftTab = candidate.activeLeftTab === "hierarchy" ? "hierarchy" : "assets";
  const activeInspectorTab = candidate.activeInspectorTab === "route" ? "route" : "object";
  const density = candidate.density === "compact" ? "compact" : "comfortable";

  const leftWidth = Number(candidate.leftWidth);
  const rightWidth = Number(candidate.rightWidth);
  if (!Number.isFinite(leftWidth) || !Number.isFinite(rightWidth)) {
    return null;
  }

  return {
    leftWidth: clampDockWidth("left", leftWidth),
    rightWidth: clampDockWidth("right", rightWidth),
    leftCollapsed: Boolean(candidate.leftCollapsed),
    rightCollapsed: Boolean(candidate.rightCollapsed),
    activeLeftTab,
    activeInspectorTab,
    density
  };
}

function loadDockLayoutState(): BuilderDockLayoutState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_DOCK_LAYOUT_STATE };
  }

  try {
    const raw = window.localStorage.getItem(V2_DOCK_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_DOCK_LAYOUT_STATE };
    }

    const parsed = parseDockLayoutState(JSON.parse(raw));
    if (!parsed) {
      return { ...DEFAULT_DOCK_LAYOUT_STATE };
    }

    return parsed;
  } catch {
    return { ...DEFAULT_DOCK_LAYOUT_STATE };
  }
}

function persistDockLayoutState(dockLayout: BuilderDockLayoutState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(V2_DOCK_LAYOUT_STORAGE_KEY, JSON.stringify(dockLayout));
  } catch {
    // Ignore persistence failures to keep editor interactions resilient.
  }
}

export function createBuilderShellStore(adapter: SceneBuilderAdapter) {
  const createInitialState = (): BuilderShellState => {
    const snapshot = adapter.getSnapshot();
    const routeEditState = adapter.getRouteEditState();
    const selectedAssetId = resolveSelectedAsset(snapshot, null);
    const worldState = adapter.getWorldState();
    const dockLayout = loadDockLayoutState();

    if (routeEditState.routeModeEnabled && dockLayout.activeInspectorTab !== "route") {
      dockLayout.activeInspectorTab = "route";
    }

    return {
      snapshot,
      routeEditState,
      selectedAssetId,
      worldState,
      worldNameDraft: worldState.currentWorldName,
      transformMode: adapter.getTransformMode(),
      cameraNavigationEnabled: adapter.isCameraNavigationEnabled(),
      statusNotice: null,
      uploadInputValueKey: 0,
      dockLayout
    };
  };

  return createStore<BuilderShellStoreState>()((set, get) => ({
    ...createInitialState(),
    refreshFromAdapter: () => {
      set((state) => {
        const snapshot = adapter.getSnapshot();
        const routeEditState = adapter.getRouteEditState();
        const worldState = adapter.getWorldState();
        const shouldResetWorldNameDraft =
          worldState.currentWorldName !== state.worldState.currentWorldName || !state.worldNameDraft.trim();
        const shouldForceRouteInspector =
          routeEditState.routeModeEnabled && state.dockLayout.activeInspectorTab !== "route";
        const dockLayout = shouldForceRouteInspector
          ? {
              ...state.dockLayout,
              activeInspectorTab: "route" as const
            }
          : state.dockLayout;

        if (dockLayout !== state.dockLayout) {
          persistDockLayoutState(dockLayout);
        }

        return {
          snapshot,
          routeEditState,
          selectedAssetId: resolveSelectedAsset(snapshot, state.selectedAssetId),
          worldState,
          worldNameDraft: shouldResetWorldNameDraft ? worldState.currentWorldName : state.worldNameDraft,
          transformMode: adapter.getTransformMode(),
          cameraNavigationEnabled: adapter.isCameraNavigationEnabled(),
          dockLayout
        };
      });
    },
    setSelectedAsset: (assetId) => {
      set({ selectedAssetId: assetId });
    },
    setActiveLeftTab: (tab) => {
      set((state) => {
        if (state.dockLayout.activeLeftTab === tab) {
          return state;
        }

        const dockLayout = {
          ...state.dockLayout,
          activeLeftTab: tab
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    setActiveInspectorTab: (tab) => {
      set((state) => {
        if (state.dockLayout.activeInspectorTab === tab) {
          return state;
        }

        const dockLayout = {
          ...state.dockLayout,
          activeInspectorTab: tab
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    setDockCollapsed: (side, collapsed) => {
      set((state) => {
        const leftCollapsed = side === "left" ? collapsed : state.dockLayout.leftCollapsed;
        const rightCollapsed = side === "right" ? collapsed : state.dockLayout.rightCollapsed;

        if (
          leftCollapsed === state.dockLayout.leftCollapsed &&
          rightCollapsed === state.dockLayout.rightCollapsed
        ) {
          return state;
        }

        const dockLayout = {
          ...state.dockLayout,
          leftCollapsed,
          rightCollapsed
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    toggleDockCollapsed: (side) => {
      set((state) => {
        const dockLayout = {
          ...state.dockLayout,
          leftCollapsed: side === "left" ? !state.dockLayout.leftCollapsed : state.dockLayout.leftCollapsed,
          rightCollapsed: side === "right" ? !state.dockLayout.rightCollapsed : state.dockLayout.rightCollapsed
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    setDockWidth: (side, width) => {
      set((state) => {
        const clampedWidth = clampDockWidth(side, width);
        if (side === "left") {
          if (state.dockLayout.leftWidth === clampedWidth && !state.dockLayout.leftCollapsed) {
            return state;
          }

          const dockLayout = {
            ...state.dockLayout,
            leftWidth: clampedWidth,
            leftCollapsed: false
          };
          persistDockLayoutState(dockLayout);
          return {
            dockLayout
          };
        }

        if (state.dockLayout.rightWidth === clampedWidth && !state.dockLayout.rightCollapsed) {
          return state;
        }

        const dockLayout = {
          ...state.dockLayout,
          rightWidth: clampedWidth,
          rightCollapsed: false
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    setDockDensity: (density) => {
      set((state) => {
        if (state.dockLayout.density === density) {
          return state;
        }

        const dockLayout = {
          ...state.dockLayout,
          density
        };
        persistDockLayoutState(dockLayout);
        return {
          dockLayout
        };
      });
    },
    setWorldNameDraft: (value) => {
      set({ worldNameDraft: value });
    },
    saveWorld: () => {
      const worldNameDraft = get().worldNameDraft;
      adapter.saveWorld(worldNameDraft);
    },
    saveWorldAs: () => {
      const worldNameDraft = get().worldNameDraft;
      adapter.saveWorldAs(worldNameDraft);
    },
    viewWorld: () => {
      if (get().worldState.hasSavedWorld) {
        adapter.viewWorld();
      }
    },
    backToMenu: () => {
      adapter.backToMenu();
    },
    setTransformMode: (mode) => {
      adapter.setTransformMode(mode);
      set({ transformMode: mode });
    },
    toggleCameraNavigation: () => {
      const nextEnabled = !adapter.isCameraNavigationEnabled();
      adapter.setCameraNavigationEnabled(nextEnabled);
      set({ cameraNavigationEnabled: nextEnabled });
    },
    toggleRouteMode: () => {
      const currentRouteEditState = adapter.getRouteEditState();
      adapter.setRouteModeEnabled(!currentRouteEditState.routeModeEnabled);
    },
    createRoute: (name) => adapter.createRoute(name),
    selectRoute: (routeId) => {
      adapter.selectRoute(routeId);
    },
    deleteSelectedRoute: () => {
      const selectedRouteId = adapter.getRouteEditState().selectedRouteId;
      if (!selectedRouteId) {
        return false;
      }

      return adapter.deleteRoute(selectedRouteId);
    },
    setDefaultRoute: (routeId) => {
      adapter.setDefaultRoute(routeId);
    },
    addRoutePointFromCurrentCamera: (dwellMs) => adapter.addPointFromCurrentCamera(dwellMs),
    updateRouteSettings: (patch) => adapter.updateRouteSettings(patch),
    previewSelectedRoute: () => adapter.previewSelectedRoute(),
    stopRoutePreview: (options) => {
      adapter.stopRoutePreview(options);
    },
    selectRoutePoint: (pointIndex) => {
      adapter.selectRoutePoint(pointIndex);
    },
    deleteSelectedRoutePoint: () => {
      const selectedPointIndex = adapter.getRouteEditState().selectedPointIndex;
      if (selectedPointIndex === null) {
        return false;
      }

      return adapter.removeRoutePoint(selectedPointIndex);
    },
    moveSelectedRoutePoint: (direction) => {
      const selectedPointIndex = adapter.getRouteEditState().selectedPointIndex;
      if (selectedPointIndex === null) {
        return false;
      }

      return adapter.moveRoutePoint(selectedPointIndex, direction);
    },
    updateSelectedRoutePointFromCurrentCamera: () => adapter.updateSelectedRoutePointFromCurrentCamera(),
    updateSelectedRoutePointDwellMs: (dwellMs) => adapter.updateSelectedRoutePointDwellMs(dwellMs),
    placeSelectedAsset: async () => {
      const selectedAssetId = get().selectedAssetId;
      if (!selectedAssetId) {
        return;
      }

      await adapter.placeAsset(selectedAssetId);
    },
    selectObjectById: (objectId) => {
      adapter.selectObjectById(objectId);
    },
    selectObjectWithModifiers: (objectId, options) => {
      if (options?.toggle) {
        adapter.toggleSelection(objectId);
        return;
      }

      if (options?.additive) {
        adapter.addToSelection(objectId);
        return;
      }

      adapter.replaceSelection([objectId], objectId);
    },
    clearSceneSelection: () => {
      adapter.clearSelection();
    },
    undo: async () => {
      await adapter.undo();
    },
    redo: async () => {
      await adapter.redo();
    },
    uploadAssets: async (files, category) => {
      if (files.length === 0) {
        return;
      }

      const result = await adapter.uploadAssets(files, {
        category: category.trim() || DEFAULT_UPLOADED_ASSET_CATEGORY
      });

      const uploadedCount = result.uploaded.length;
      const failedCount = result.failed.length;
      if (uploadedCount === 0) {
        set((state) => ({
          statusNotice: result.failed[0]?.error ?? "Asset upload failed.",
          uploadInputValueKey: state.uploadInputValueKey + 1
        }));
        return;
      }

      if (failedCount === 0) {
        set((state) => ({
          statusNotice: `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"} to ${result.category}.`,
          uploadInputValueKey: state.uploadInputValueKey + 1
        }));
        return;
      }

      set((state) => ({
        statusNotice: `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"} and skipped ${failedCount}.`,
        uploadInputValueKey: state.uploadInputValueKey + 1
      }));
    },
    updateSelectedTransform: (patch) => {
      adapter.updateSelectedTransform(patch);
    },
    nudgeSelectedObject: (axis, delta) => {
      const snapshot = get().snapshot;
      const selection = snapshot.primarySelectedObject ?? snapshot.selectedObject;
      if (!selection) {
        return;
      }

      const nextValue = Number((selection.position[axis] + delta).toFixed(3));
      adapter.updateSelectedTransform({
        position: {
          [axis]: nextValue
        }
      });
    },
    rotateSelectedObject: (delta) => {
      const snapshot = get().snapshot;
      const selection = snapshot.primarySelectedObject ?? snapshot.selectedObject;
      if (!selection) {
        return;
      }

      adapter.updateSelectedTransform({
        rotationY: Number((selection.rotationY + delta).toFixed(3))
      });
    },
    deleteSelectedObject: () => {
      adapter.deleteSelectedObject();
    },
    duplicateSelectedObject: async () => {
      await adapter.duplicateSelectedObject();
    },
    clearStatusNotice: () => {
      set({ statusNotice: null });
    }
  }));
}
