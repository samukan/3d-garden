import { createStore } from "zustand/vanilla";

import type { BuilderSceneSnapshot } from "../builder/builderTypes";
import { DEFAULT_UPLOADED_ASSET_CATEGORY, type AssetId } from "../generation/natureKitAssetManifest";
import type { BuilderPanelWorldState } from "../ui/builderPanel";
import type { SceneBuilderAdapter } from "./sceneBuilderAdapter";

interface BuilderShellState {
  snapshot: BuilderSceneSnapshot;
  selectedAssetId: AssetId | null;
  worldState: BuilderPanelWorldState;
  worldNameDraft: string;
  transformMode: "move" | "rotate" | "scale";
  cameraNavigationEnabled: boolean;
  statusNotice: string | null;
  uploadInputValueKey: number;
}

interface BuilderShellActions {
  refreshFromAdapter: () => void;
  setSelectedAsset: (assetId: AssetId | null) => void;
  setWorldNameDraft: (value: string) => void;
  saveWorld: () => void;
  saveWorldAs: () => void;
  viewWorld: () => void;
  backToMenu: () => void;
  setTransformMode: (mode: "move" | "rotate" | "scale") => void;
  toggleCameraNavigation: () => void;
  placeSelectedAsset: () => Promise<void>;
  selectObjectById: (objectId: string | null) => void;
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

export function createBuilderShellStore(adapter: SceneBuilderAdapter) {
  const createInitialState = (): BuilderShellState => {
    const snapshot = adapter.getSnapshot();
    const selectedAssetId = resolveSelectedAsset(snapshot, null);
    const worldState = adapter.getWorldState();
    return {
      snapshot,
      selectedAssetId,
      worldState,
      worldNameDraft: worldState.currentWorldName,
      transformMode: adapter.getTransformMode(),
      cameraNavigationEnabled: adapter.isCameraNavigationEnabled(),
      statusNotice: null,
      uploadInputValueKey: 0
    };
  };

  return createStore<BuilderShellStoreState>()((set, get) => ({
    ...createInitialState(),
    refreshFromAdapter: () => {
      set((state) => {
        const snapshot = adapter.getSnapshot();
        const worldState = adapter.getWorldState();
        const shouldResetWorldNameDraft =
          worldState.currentWorldName !== state.worldState.currentWorldName || !state.worldNameDraft.trim();

        return {
          snapshot,
          selectedAssetId: resolveSelectedAsset(snapshot, state.selectedAssetId),
          worldState,
          worldNameDraft: shouldResetWorldNameDraft ? worldState.currentWorldName : state.worldNameDraft,
          transformMode: adapter.getTransformMode(),
          cameraNavigationEnabled: adapter.isCameraNavigationEnabled()
        };
      });
    },
    setSelectedAsset: (assetId) => {
      set({ selectedAssetId: assetId });
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
      const selection = get().snapshot.selectedObject;
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
      const selection = get().snapshot.selectedObject;
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
