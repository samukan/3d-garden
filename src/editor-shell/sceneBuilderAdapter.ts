import type { BuilderSceneSnapshot } from "../builder/builderTypes";
import type {
  BuilderScreenRect,
  BuilderSelectionMergeMode,
  BuilderTransformMode,
  SceneBuilderController,
  UploadedAssetBatchUploadResult
} from "../builder/sceneBuilder";
import type { BuilderVector3 } from "../builder/builderTypes";
import type { BuilderPanelWorldState, CreateBuilderPanelOptions } from "../ui/builderPanel";

export interface SceneBuilderAdapter {
  getSnapshot: () => BuilderSceneSnapshot;
  getTransformMode: () => BuilderTransformMode;
  isCameraNavigationEnabled: () => boolean;
  subscribe: (listener: () => void) => () => void;
  getWorldState: () => BuilderPanelWorldState;
  setWorldState: (state: BuilderPanelWorldState) => void;
  saveWorld: (worldName: string) => void;
  saveWorldAs: (worldName: string) => void;
  viewWorld: () => void;
  backToMenu: () => void;
  setTransformMode: (mode: BuilderTransformMode) => void;
  setCameraNavigationEnabled: (enabled: boolean) => void;
  placeAsset: (assetId: string) => Promise<void>;
  canStartMarqueeSelectionAt: (clientX: number, clientY: number) => boolean;
  applyMarqueeSelection: (rect: BuilderScreenRect, mode: BuilderSelectionMergeMode) => void;
  replaceSelection: (objectIds: string[], primaryObjectId?: string | null) => void;
  addToSelection: (objectId: string) => void;
  toggleSelection: (objectId: string) => void;
  removeFromSelection: (objectId: string) => void;
  clearSelection: () => void;
  selectObjectById: (objectId: string | null) => void;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  uploadAssets: (files: File[], options?: { category?: string }) => Promise<UploadedAssetBatchUploadResult>;
  deleteSelectedObject: () => void;
  duplicateSelectedObject: () => Promise<void>;
  updateSelectedTransform: (patch: {
    position?: Partial<BuilderVector3>;
    rotationY?: number;
    scale?: number;
  }) => void;
  dispose: () => void;
}

export function createSceneBuilderAdapter(
  sceneBuilder: SceneBuilderController,
  options: CreateBuilderPanelOptions
): SceneBuilderAdapter {
  let worldState: BuilderPanelWorldState = { ...options.worldState };
  const listeners = new Set<() => void>();

  const emitChange = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const unsubscribeScene = sceneBuilder.subscribe(() => {
    emitChange();
  });

  return {
    getSnapshot: () => sceneBuilder.getSnapshot(),
    getTransformMode: () => sceneBuilder.getTransformMode(),
    isCameraNavigationEnabled: () => sceneBuilder.isCameraNavigationEnabled(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getWorldState: () => worldState,
    setWorldState: (state) => {
      worldState = { ...state };
      emitChange();
    },
    saveWorld: (worldName) => {
      options.onSave(worldName);
    },
    saveWorldAs: (worldName) => {
      options.onSaveAs(worldName);
    },
    viewWorld: () => {
      options.onViewWorld();
    },
    backToMenu: () => {
      options.onBackToMenu();
    },
    setTransformMode: (mode) => {
      sceneBuilder.setTransformMode(mode);
    },
    setCameraNavigationEnabled: (enabled) => {
      sceneBuilder.setCameraNavigationEnabled(enabled);
    },
    placeAsset: async (assetId) => {
      await sceneBuilder.placeAsset(assetId);
    },
    canStartMarqueeSelectionAt: (clientX, clientY) => {
      return sceneBuilder.canStartMarqueeSelectionAt(clientX, clientY);
    },
    applyMarqueeSelection: (rect, mode) => {
      sceneBuilder.applyMarqueeSelection(rect, mode);
    },
    replaceSelection: (objectIds, primaryObjectId) => {
      sceneBuilder.replaceSelection(objectIds, primaryObjectId);
    },
    addToSelection: (objectId) => {
      sceneBuilder.addToSelection(objectId);
    },
    toggleSelection: (objectId) => {
      sceneBuilder.toggleSelection(objectId);
    },
    removeFromSelection: (objectId) => {
      sceneBuilder.removeFromSelection(objectId);
    },
    clearSelection: () => {
      sceneBuilder.clearSelection();
    },
    selectObjectById: (objectId) => {
      sceneBuilder.selectObjectById(objectId);
    },
    undo: () => sceneBuilder.undo(),
    redo: () => sceneBuilder.redo(),
    uploadAssets: (files, uploadOptions) => sceneBuilder.uploadAssets(files, uploadOptions),
    deleteSelectedObject: () => {
      sceneBuilder.deleteSelectedObject();
    },
    duplicateSelectedObject: async () => {
      await sceneBuilder.duplicateSelectedObject();
    },
    updateSelectedTransform: (patch) => {
      sceneBuilder.updateSelectedTransform(patch);
    },
    dispose: () => {
      listeners.clear();
      unsubscribeScene();
    }
  };
}
