import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

import { createDevelopmentCamera } from "../engine/developmentCamera";
import { createAssetDefinitionMap, getAssetLabel, loadAssetDefinitions } from "../generation/assetCatalog";
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";
import type { AssetDefinition, AssetId } from "../generation/natureKitAssetManifest";
import {
  clearUploadedAssets,
  deleteUploadedAsset,
  normalizeUploadedAssetCategory,
  renameUploadedAssetCategory as renameUploadedAssetCategoryInStore,
  saveUploadedAsset
} from "../storage/uploadedAssetStore";
import { degreesToRadians, radiansToDegrees } from "../utils/angle";
import { isBrowserDebugEnabled, logBrowserDebug } from "../utils/browserDebug";
import { enableMeshVertexColors } from "../utils/meshColors";
import { getBuilderPalette } from "./builderPalette";
import { parseBuilderLayoutDocument, serializeBuilderLayout } from "./sceneLayoutSerializer";
import { createBuilderSceneState } from "./sceneBuilderState";
import type {
  BuilderLayoutRecord,
  BuilderPaletteItem,
  BuilderSceneSnapshot,
  BuilderSelectedObjectSnapshot,
  BuilderVector3
} from "./builderTypes";
import { createSelectionController } from "./selectionController";

interface CreateSceneBuilderOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
}

interface ImportLayoutOptions {
  recordHistory?: boolean;
}

export interface UploadedAssetUploadSuccess {
  assetId: AssetId;
  fileName: string;
  label: string;
}

export interface UploadedAssetUploadFailure {
  fileName: string;
  error: string;
}

export interface UploadedAssetBatchUploadResult {
  category: string;
  failed: UploadedAssetUploadFailure[];
  uploaded: UploadedAssetUploadSuccess[];
}

export type BuilderTransformMode = "move" | "rotate" | "scale";

export interface SceneBuilderController {
  scene: Scene;
  deleteSelectedObject: () => void;
  deleteObjectById: (objectId: string) => void;
  duplicateSelectedObject: () => Promise<void>;
  exportLayout: () => string;
  getSnapshot: () => BuilderSceneSnapshot;
  importLayout: (input: string, options?: ImportLayoutOptions) => Promise<{ success: boolean; error?: string }>;
  isCameraNavigationEnabled: () => boolean;
  getTransformMode: () => BuilderTransformMode;
  placeAsset: (assetId: AssetId) => Promise<void>;
  redo: () => Promise<boolean>;
  selectObjectById: (objectId: string | null) => void;
  setCameraNavigationEnabled: (enabled: boolean) => void;
  setTransformMode: (mode: BuilderTransformMode) => void;
  subscribe: (listener: () => void) => () => void;
  clearUploads: () => Promise<{ success: boolean; removedCount: number; error?: string }>;
  undo: () => Promise<boolean>;
  uploadAssets: (
    files: File[],
    options?: {
      category?: string;
    }
  ) => Promise<UploadedAssetBatchUploadResult>;
  uploadAsset: (file: File) => Promise<{ success: boolean; assetId?: AssetId; error?: string }>;
  renameUploadedAssetCategory: (assetId: AssetId, nextCategory: string) => Promise<{ success: boolean; error?: string }>;
  removeUploadedAsset: (
    assetId: AssetId
  ) => Promise<{ success: boolean; removedObjectCount: number; error?: string }>;
  updateSelectedTransform: (patch: {
    position?: Partial<BuilderVector3>;
    rotationY?: number;
    scale?: number;
  }) => void;
}

interface PlacedObjectEntry {
  layout: BuilderLayoutRecord;
  meshes: Mesh[];
  root: TransformNode;
}

interface BuilderHistorySnapshot {
  layoutRecords: BuilderLayoutRecord[];
  nextObjectNumber: number;
  selectedObjectId: string | null;
}

interface BuilderGizmoInteractionState {
  beforeSnapshot: BuilderHistorySnapshot;
  cameraNavigationEnabledBefore: boolean;
  objectId: string;
}

const HISTORY_LIMIT = 100;

export async function createSceneBuilder({
  canvas,
  engine
}: CreateSceneBuilderOptions): Promise<SceneBuilderController> {
  const scene = new Scene(engine);
  const developmentCamera = createDevelopmentCamera(scene, canvas);
  scene.activeCamera = developmentCamera.camera;
  developmentCamera.setNavigationEnabled(false);
  const state = createBuilderSceneState();
  const selectionController = createSelectionController(scene);
  const listeners = new Set<() => void>();
  const placedObjects = new Map<string, PlacedObjectEntry>();
  const nodeObjectMap = new Map<number, string>();
  const gizmoManager = new GizmoManager(scene);
  let assetDefinitions = createAssetDefinitionMap(await loadAssetDefinitions());
  let palette: BuilderPaletteItem[] = getBuilderPalette(Array.from(assetDefinitions.values()));
  let suppressNextPick = false;
  let transformMode: BuilderTransformMode = "move";
  let gizmoInteractionState: BuilderGizmoInteractionState | null = null;
  let nextObjectNumber = 1;
  let undoStack: BuilderHistorySnapshot[] = [];
  let redoStack: BuilderHistorySnapshot[] = [];
  let historyRestoreInFlight = false;

  scene.clearColor = new Color4(0.79, 0.87, 0.92, 1);
  scene.ambientColor = new Color3(0.2, 0.24, 0.22);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0056;
  scene.fogColor = new Color3(0.86, 0.91, 0.9);

  const hemiLight = new HemisphericLight("builder-hemi", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.95;
  hemiLight.diffuse = new Color3(0.96, 0.97, 0.92);
  hemiLight.groundColor = new Color3(0.18, 0.2, 0.18);

  const sunLight = new DirectionalLight("builder-sun", new Vector3(-0.4, -1, 0.28), scene);
  sunLight.position = new Vector3(28, 36, -18);
  sunLight.intensity = 0.85;
  sunLight.diffuse = new Color3(1, 0.96, 0.88);

  const ground = MeshBuilder.CreateGround(
    "builder-ground",
    { width: 128, height: 128, subdivisions: 2 },
    scene
  );
  const groundMaterial = new StandardMaterial("builder-ground-material", scene);
  groundMaterial.diffuseColor = new Color3(0.44, 0.55, 0.4);
  groundMaterial.emissiveColor = new Color3(0.018, 0.028, 0.018);
  groundMaterial.specularColor = Color3.Black();
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  const guideMaterial = new StandardMaterial("builder-guide-material", scene);
  guideMaterial.diffuseColor = new Color3(0.71, 0.67, 0.54);
  guideMaterial.emissiveColor = new Color3(0.022, 0.018, 0.012);
  guideMaterial.specularColor = Color3.Black();

  const guideStrip = MeshBuilder.CreateGround(
    "builder-guide-strip",
    { width: 6, height: 24, subdivisions: 1 },
    scene
  );
  guideStrip.position = new Vector3(0, 0.02, 0);
  guideStrip.material = guideMaterial;

  const crossStrip = MeshBuilder.CreateGround(
    "builder-cross-strip",
    { width: 24, height: 6, subdivisions: 1 },
    scene
  );
  crossStrip.position = new Vector3(0, 0.021, 0);
  crossStrip.material = guideMaterial;

  const assetLibrary = await loadNatureKitAssetLibrary(scene, Array.from(assetDefinitions.values()));

  const logSceneSnapshot = (label: string): void => {
    logBrowserDebug("builder:scene", {
      label,
      meshCount: scene.meshes.length,
      rootNodes: scene.rootNodes.length,
      activeCamera: scene.activeCamera?.name ?? "none",
      cameraNavigationEnabled: developmentCamera.isNavigationEnabled(),
      camera: {
        alpha: Number(developmentCamera.camera.alpha.toFixed(3)),
        beta: Number(developmentCamera.camera.beta.toFixed(3)),
        radius: Number(developmentCamera.camera.radius.toFixed(3)),
        target: {
          x: Number(developmentCamera.camera.target.x.toFixed(3)),
          y: Number(developmentCamera.camera.target.y.toFixed(3)),
          z: Number(developmentCamera.camera.target.z.toFixed(3))
        }
      }
    });
  };

  gizmoManager.usePointerToAttachGizmos = false;
  gizmoManager.clearGizmoOnEmptyPointerEvent = false;

  if (isBrowserDebugEnabled()) {
    const debugMarker = MeshBuilder.CreateBox("builder-debug-origin", { size: 0.8 }, scene);
    debugMarker.position = new Vector3(0, 0.4, 0);
    const debugMaterial = new StandardMaterial("builder-debug-origin-material", scene);
    debugMaterial.emissiveColor = new Color3(0.95, 0.2, 0.2);
    debugMaterial.diffuseColor = new Color3(0.95, 0.2, 0.2);
    debugMaterial.specularColor = Color3.Black();
    debugMarker.material = debugMaterial;
  }

  logSceneSnapshot("init");

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setAssetDefinitions = (nextAssetDefinitions: AssetDefinition[]): void => {
    assetDefinitions = createAssetDefinitionMap(nextAssetDefinitions);
    palette = getBuilderPalette(Array.from(assetDefinitions.values()));
    assetLibrary.setDefinitions(Array.from(assetDefinitions.values()));
  };

  const upsertAssetDefinition = (definition: AssetDefinition): void => {
    assetDefinitions.set(definition.id, definition);
    palette = getBuilderPalette(Array.from(assetDefinitions.values()));
    assetLibrary.setDefinitions(Array.from(assetDefinitions.values()));
  };

  const removeAssetDefinition = (assetId: AssetId): void => {
    assetDefinitions.delete(assetId);
    palette = getBuilderPalette(Array.from(assetDefinitions.values()));
    assetLibrary.setDefinitions(Array.from(assetDefinitions.values()));
  };

  const refreshAssetCatalog = async (options?: { notify?: boolean }): Promise<void> => {
    setAssetDefinitions(await loadAssetDefinitions());

    if (options?.notify !== false) {
      notify();
    }
  };

  const cloneLayoutRecord = (record: BuilderLayoutRecord): BuilderLayoutRecord => ({
    id: record.id,
    assetId: record.assetId,
    position: { ...record.position },
    rotationY: record.rotationY,
    scale: record.scale
  });

  const captureHistorySnapshot = (): BuilderHistorySnapshot => ({
    layoutRecords: state.layoutRecords.map(cloneLayoutRecord),
    nextObjectNumber,
    selectedObjectId: state.selectedObjectId
  });

  const clearHistory = (): void => {
    undoStack = [];
    redoStack = [];
  };

  const pushUndoSnapshot = (snapshot: BuilderHistorySnapshot): void => {
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.shift();
    }
    redoStack = [];
  };

  const setGizmoAttachmentForSelection = (): void => {
    if (!state.selectedObjectId) {
      gizmoManager.attachToNode(null);
      return;
    }

    const selectedEntry = placedObjects.get(state.selectedObjectId);
    gizmoManager.attachToNode(selectedEntry?.root ?? null);
  };

  const applyTransformMode = (): void => {
    gizmoManager.positionGizmoEnabled = transformMode === "move";
    gizmoManager.rotationGizmoEnabled = transformMode === "rotate";
    gizmoManager.scaleGizmoEnabled = transformMode === "scale";
  };

  const updateLayoutFromRootNode = (
    objectId: string,
    options?: {
      silentStatus?: boolean;
      statusMessage?: string;
    }
  ): boolean => {
    const entry = placedObjects.get(objectId);
    if (!entry) {
      return false;
    }

    const definition = assetDefinitions.get(entry.layout.assetId);
    if (!definition) {
      return false;
    }

    const nextScaleRaw = entry.root.scaling.x / definition.scale;
    const nextScale = Number(nextScaleRaw.toFixed(3));

    return updateObjectTransform(
      objectId,
      {
        position: {
          x: Number(entry.root.position.x.toFixed(3)),
          y: Number(entry.root.position.y.toFixed(3)),
          z: Number(entry.root.position.z.toFixed(3))
        },
        rotationY: Number(radiansToDegrees(entry.root.rotation.y - definition.rotationY).toFixed(3)),
        scale: nextScale > 0 ? nextScale : entry.layout.scale
      },
      options
    );
  };

  const restoreCameraNavigationState = (shouldEnableCamera: boolean): void => {
    if (developmentCamera.isNavigationEnabled() !== shouldEnableCamera) {
      developmentCamera.setNavigationEnabled(shouldEnableCamera);
    }
  };

  const beginGizmoInteraction = (): void => {
    if (historyRestoreInFlight || gizmoInteractionState || !state.selectedObjectId) {
      return;
    }

    gizmoInteractionState = {
      beforeSnapshot: captureHistorySnapshot(),
      cameraNavigationEnabledBefore: developmentCamera.isNavigationEnabled(),
      objectId: state.selectedObjectId
    };

    if (developmentCamera.isNavigationEnabled()) {
      developmentCamera.setNavigationEnabled(false);
    }

    state.statusMessage = "Transforming selected object...";
    suppressNextPick = true;
    notify();
  };

  const completeGizmoInteraction = (): void => {
    if (!gizmoInteractionState) {
      return;
    }

    const interactionState = gizmoInteractionState;
    gizmoInteractionState = null;

    const didChange = updateLayoutFromRootNode(interactionState.objectId, { silentStatus: true });
    if (didChange) {
      pushUndoSnapshot(interactionState.beforeSnapshot);
      const entry = placedObjects.get(interactionState.objectId);
      if (entry) {
        state.statusMessage = `Transformed ${getAssetLabel(assetDefinitions, entry.layout.assetId)}.`;
      }
    } else {
      state.statusMessage = "Transform unchanged.";
    }

    restoreCameraNavigationState(interactionState.cameraNavigationEnabledBefore);
    notify();
  };

  const cancelGizmoInteraction = (): void => {
    if (!gizmoInteractionState) {
      return;
    }

    const cameraNavigationEnabledBefore = gizmoInteractionState.cameraNavigationEnabledBefore;
    gizmoInteractionState = null;
    restoreCameraNavigationState(cameraNavigationEnabledBefore);
  };

  const getSelectedObjectSnapshot = (): BuilderSelectedObjectSnapshot | null => {
    if (!state.selectedObjectId) {
      return null;
    }

    const entry = placedObjects.get(state.selectedObjectId);
    if (!entry) {
      return null;
    }

    return {
      ...cloneLayoutRecord(entry.layout),
      assetLabel: getAssetLabel(assetDefinitions, entry.layout.assetId)
    };
  };

  const getSnapshot = (): BuilderSceneSnapshot => ({
    isReady: state.isReady,
    palette,
    objects: state.layoutRecords.map((record) => ({
      ...cloneLayoutRecord(record),
      assetLabel: getAssetLabel(assetDefinitions, record.assetId)
    })),
    selectedObjectId: state.selectedObjectId,
    selectedObject: getSelectedObjectSnapshot(),
    statusMessage: state.statusMessage
  });

  const setCameraNavigationEnabled = (enabled: boolean): void => {
    if (developmentCamera.isNavigationEnabled() === enabled) {
      return;
    }

    developmentCamera.setNavigationEnabled(enabled);
    suppressNextPick = false;
    state.statusMessage = enabled
      ? "Camera navigation enabled."
      : "Object edit mode enabled. Camera navigation locked.";
    notify();
  };

  const applyLayoutToEntry = (entry: PlacedObjectEntry): void => {
    const definition = assetDefinitions.get(entry.layout.assetId);
    if (!definition) {
      return;
    }

    entry.root.position.set(entry.layout.position.x, entry.layout.position.y, entry.layout.position.z);
    entry.root.rotation.set(0, definition.rotationY + degreesToRadians(entry.layout.rotationY), 0);

    const finalScale = definition.scale * entry.layout.scale;
    entry.root.scaling.set(finalScale, finalScale, finalScale);
  };

  const registerNodeMap = (entry: PlacedObjectEntry): void => {
    nodeObjectMap.set(entry.root.uniqueId, entry.layout.id);

    for (const mesh of entry.meshes) {
      nodeObjectMap.set(mesh.uniqueId, entry.layout.id);
    }
  };

  const unregisterNodeMap = (entry: PlacedObjectEntry): void => {
    nodeObjectMap.delete(entry.root.uniqueId);

    for (const mesh of entry.meshes) {
      nodeObjectMap.delete(mesh.uniqueId);
    }
  };

  const setSelection = (objectId: string | null): void => {
    state.selectedObjectId = objectId;

    if (!objectId) {
      selectionController.setSelection([]);
      setGizmoAttachmentForSelection();
      notify();
      return;
    }

    const entry = placedObjects.get(objectId);
    selectionController.setSelection(entry?.meshes ?? []);
    setGizmoAttachmentForSelection();
    notify();
  };

  const selectObjectById = (objectId: string | null): void => {
    if (objectId && !placedObjects.has(objectId)) {
      return;
    }

    setSelection(objectId);
  };

  const setTransformMode = (mode: BuilderTransformMode): void => {
    if (transformMode === mode) {
      return;
    }

    transformMode = mode;
    applyTransformMode();
    state.statusMessage =
      mode === "move"
        ? "Move gizmo enabled."
        : mode === "rotate"
          ? "Rotate gizmo enabled."
          : "Scale gizmo enabled.";
    notify();
  };

  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.rotationGizmoEnabled = true;
  gizmoManager.scaleGizmoEnabled = true;

  const positionGizmo = gizmoManager.gizmos.positionGizmo;
  const rotationGizmo = gizmoManager.gizmos.rotationGizmo;
  const scaleGizmo = gizmoManager.gizmos.scaleGizmo;
  gizmoManager.scaleRatio = 1.15;

  if (scaleGizmo) {
    // Keep builder scale operations uniform so they map cleanly to layout.scale.
    scaleGizmo.xGizmo.isEnabled = false;
    scaleGizmo.yGizmo.isEnabled = false;
    scaleGizmo.zGizmo.isEnabled = false;
    scaleGizmo.uniformScaleGizmo.isEnabled = true;
  }

  positionGizmo?.onDragStartObservable.add(() => {
    beginGizmoInteraction();
  });
  positionGizmo?.onDragEndObservable.add(() => {
    completeGizmoInteraction();
  });
  rotationGizmo?.onDragStartObservable.add(() => {
    beginGizmoInteraction();
  });
  rotationGizmo?.onDragEndObservable.add(() => {
    completeGizmoInteraction();
  });
  scaleGizmo?.onDragStartObservable.add(() => {
    beginGizmoInteraction();
  });
  scaleGizmo?.onDragEndObservable.add(() => {
    completeGizmoInteraction();
  });

  applyTransformMode();

  const instantiateRecord = async (record: BuilderLayoutRecord): Promise<boolean> => {
    const definition = assetDefinitions.get(record.assetId);
    if (!definition) {
      state.statusMessage = `Asset is not available locally: ${record.assetId}.`;
      notify();
      return false;
    }

    let root: TransformNode;

    try {
      root = await assetLibrary.instantiateAsset(
        record.assetId,
        record.id,
        new Vector3(record.position.x, record.position.y, record.position.z)
      );
    } catch (error) {
      state.statusMessage = error instanceof Error ? error.message : `Could not load ${definition.label}.`;
      notify();
      return false;
    }

    const meshes = root.getChildMeshes(false).filter((mesh): mesh is Mesh => mesh instanceof Mesh);

    for (const mesh of meshes) {
      enableMeshVertexColors(mesh, { log: true });
    }

    logBrowserDebug("builder:placed-asset", {
      assetId: record.assetId,
      meshCount: meshes.length,
      root: {
        name: root.name,
        enabled: root.isEnabled(),
        position: {
          x: Number(root.position.x.toFixed(3)),
          y: Number(root.position.y.toFixed(3)),
          z: Number(root.position.z.toFixed(3))
        },
        scaling: {
          x: Number(root.scaling.x.toFixed(3)),
          y: Number(root.scaling.y.toFixed(3)),
          z: Number(root.scaling.z.toFixed(3))
        }
      }
    });
    const entry: PlacedObjectEntry = {
      layout: record,
      meshes,
      root
    };

    applyLayoutToEntry(entry);
    placedObjects.set(record.id, entry);
    state.layoutRecords.push(record);
    registerNodeMap(entry);
    return true;
  };

  const disposeEntry = (entry: PlacedObjectEntry): void => {
    unregisterNodeMap(entry);
    // Instances can share material/texture resources from their source container.
    // Avoid disposing shared materials during object delete/undo/redo restores.
    entry.root.dispose(false);
    placedObjects.delete(entry.layout.id);
  };

  const clearAllObjects = (): void => {
    for (const entry of placedObjects.values()) {
      // Instances can share material/texture resources from their source container.
      // Avoid disposing shared materials during object delete/undo/redo restores.
      entry.root.dispose(false);
    }

    placedObjects.clear();
    nodeObjectMap.clear();
    state.layoutRecords = [];
    selectionController.setSelection([]);
    state.selectedObjectId = null;
    gizmoManager.attachToNode(null);
    cancelGizmoInteraction();
    suppressNextPick = false;
  };

  const restoreHistorySnapshot = async (
    snapshot: BuilderHistorySnapshot,
    options?: { statusMessage?: string }
  ): Promise<boolean> => {
    clearAllObjects();

    let skippedCount = 0;
    let firstObjectId: string | null = null;

    for (const record of snapshot.layoutRecords.map(cloneLayoutRecord)) {
      const didInstantiate = await instantiateRecord(record);
      if (didInstantiate) {
        firstObjectId ??= record.id;
      } else {
        skippedCount += 1;
      }
    }

    nextObjectNumber = snapshot.nextObjectNumber;
    const desiredSelectionId = snapshot.selectedObjectId;
    const fallbackSelectionId = desiredSelectionId && placedObjects.has(desiredSelectionId)
      ? desiredSelectionId
      : firstObjectId;
    const statusSuffix = skippedCount > 0
      ? ` ${skippedCount} object${skippedCount === 1 ? "" : "s"} could not be restored.`
      : "";
    state.statusMessage = `${options?.statusMessage ?? "History restored."}${statusSuffix}`;
    setSelection(fallbackSelectionId);
    return true;
  };

  const clearUploads = async (): Promise<{ success: boolean; removedCount: number; error?: string }> => {
    state.statusMessage = "Clearing uploads...";
    notify();

    try {
      const removedIds = await clearUploadedAssets();
      clearAllObjects();
      nextObjectNumber = 1;
      clearHistory();

      if (removedIds.length > 0) {
        await assetLibrary.evictAssets(removedIds);
      }

      await refreshAssetCatalog({ notify: false });
      state.statusMessage =
        removedIds.length > 0
          ? `Cleared ${removedIds.length} uploaded asset${removedIds.length === 1 ? "" : "s"}.`
          : "No uploaded assets to clear.";
      notify();
      return { success: true, removedCount: removedIds.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Uploaded assets could not be cleared.";
      state.statusMessage = message;
      notify();
      return { success: false, removedCount: 0, error: message };
    }
  };

  const createObjectId = (): string => {
    const objectId = `builder-object-${nextObjectNumber}`;
    nextObjectNumber += 1;
    return objectId;
  };

  const getSpawnPosition = (): BuilderVector3 => {
    const target = developmentCamera.camera.getTarget();
    const forward = target.subtract(developmentCamera.camera.position);
    const flattenedForward = new Vector3(forward.x, 0, forward.z);
    const horizontalForward = flattenedForward.lengthSquared() > 0.0001
      ? flattenedForward.normalize()
      : new Vector3(0, 0, 1);
    const spawnDistance = Math.max(3.5, Math.min(12, developmentCamera.camera.radius * 0.2));
    const spawn = target.add(horizontalForward.scale(spawnDistance));

    return {
      x: Number(spawn.x.toFixed(3)),
      y: 0,
      z: Number(spawn.z.toFixed(3))
    };
  };

  const resolveObjectIdForMesh = (mesh: AbstractMesh | null): string | null => {
    let current: { parent: unknown; uniqueId: number } | null = mesh;

    while (current) {
      const objectId = nodeObjectMap.get(current.uniqueId);
      if (objectId) {
        return objectId;
      }

      current = current.parent as { parent: unknown; uniqueId: number } | null;
    }

    return null;
  };

  const updateObjectTransform = (
    objectId: string,
    patch: {
      position?: Partial<BuilderVector3>;
      rotationY?: number;
      scale?: number;
    },
    options?: {
      statusMessage?: string;
      silentStatus?: boolean;
    }
  ): boolean => {
    const entry = placedObjects.get(objectId);
    if (!entry) {
      return false;
    }

    let didChange = false;

    if (patch.position) {
      if (typeof patch.position.x === "number" && Number.isFinite(patch.position.x)) {
        if (entry.layout.position.x !== patch.position.x) {
          entry.layout.position.x = patch.position.x;
          didChange = true;
        }
      }

      if (typeof patch.position.y === "number" && Number.isFinite(patch.position.y)) {
        if (entry.layout.position.y !== patch.position.y) {
          entry.layout.position.y = patch.position.y;
          didChange = true;
        }
      }

      if (typeof patch.position.z === "number" && Number.isFinite(patch.position.z)) {
        if (entry.layout.position.z !== patch.position.z) {
          entry.layout.position.z = patch.position.z;
          didChange = true;
        }
      }
    }

    if (typeof patch.rotationY === "number" && Number.isFinite(patch.rotationY)) {
      if (entry.layout.rotationY !== patch.rotationY) {
        entry.layout.rotationY = patch.rotationY;
        didChange = true;
      }
    }

    if (typeof patch.scale === "number" && Number.isFinite(patch.scale) && patch.scale > 0) {
      if (entry.layout.scale !== patch.scale) {
        entry.layout.scale = patch.scale;
        didChange = true;
      }
    }

    if (!didChange) {
      return false;
    }

    applyLayoutToEntry(entry);

    if (!options?.silentStatus) {
      state.statusMessage = options?.statusMessage ?? `Updated ${getAssetLabel(assetDefinitions, entry.layout.assetId)}.`;
    }

    notify();
    return true;
  };

  const placeAsset = async (assetId: AssetId): Promise<void> => {
    if (historyRestoreInFlight) {
      return;
    }

    if (!state.isReady) {
      state.statusMessage = "Builder assets are still loading.";
      notify();
      return;
    }

    const definition = assetDefinitions.get(assetId);
    if (!definition) {
      state.statusMessage = `Asset is not available locally: ${assetId}.`;
      notify();
      return;
    }

    const record: BuilderLayoutRecord = {
      id: createObjectId(),
      assetId,
      position: getSpawnPosition(),
      rotationY: 0,
      scale: 1
    };
    const beforeSnapshot = captureHistorySnapshot();

    state.statusMessage = `Loading ${definition.label}...`;
    notify();

    const didInstantiate = await instantiateRecord(record);
    if (!didInstantiate) {
      return;
    }

    state.statusMessage = `Placed ${definition.label}.`;
    pushUndoSnapshot(beforeSnapshot);
    setSelection(record.id);
  };

  const updateSelectedTransform = (patch: {
    position?: Partial<BuilderVector3>;
    rotationY?: number;
    scale?: number;
  }): void => {
    if (!state.selectedObjectId) {
      return;
    }

    const beforeSnapshot = captureHistorySnapshot();
    const didChange = updateObjectTransform(state.selectedObjectId, patch);
    if (!didChange) {
      return;
    }

    pushUndoSnapshot(beforeSnapshot);
  };

  const deleteObjectByIdInternal = (objectId: string, options?: { recordHistory?: boolean }): boolean => {
    if (historyRestoreInFlight) {
      return false;
    }

    const entry = placedObjects.get(objectId);
    if (!entry) {
      return false;
    }

    const beforeSnapshot = options?.recordHistory === false ? null : captureHistorySnapshot();
    const removedIndex = state.layoutRecords.findIndex((record) => record.id === objectId);
    const label = getAssetLabel(assetDefinitions, entry.layout.assetId);
    const wasSelected = state.selectedObjectId === objectId;
    if (gizmoInteractionState?.objectId === objectId) {
      cancelGizmoInteraction();
    }

    disposeEntry(entry);
    state.layoutRecords = state.layoutRecords.filter((record) => record.id !== objectId);
    state.statusMessage = `Deleted ${label}.`;
    if (beforeSnapshot) {
      pushUndoSnapshot(beforeSnapshot);
    }

    if (wasSelected) {
      const nextSelection =
        state.layoutRecords[removedIndex]?.id ?? state.layoutRecords[Math.max(0, removedIndex - 1)]?.id ?? null;
      setSelection(nextSelection);
      return true;
    }

    notify();
    return true;
  };

  const deleteObjectById = (objectId: string): void => {
    deleteObjectByIdInternal(objectId);
  };

  const deleteSelectedObject = (): void => {
    if (!state.selectedObjectId) {
      return;
    }

    deleteObjectByIdInternal(state.selectedObjectId);
  };

  const duplicateSelectedObject = async (): Promise<void> => {
    if (historyRestoreInFlight) {
      return;
    }

    if (!state.selectedObjectId) {
      return;
    }

    const source = placedObjects.get(state.selectedObjectId);
    if (!source) {
      return;
    }

    const duplicateRecord: BuilderLayoutRecord = {
      ...cloneLayoutRecord(source.layout),
      id: createObjectId(),
      position: {
        x: Number((source.layout.position.x + 2).toFixed(3)),
        y: source.layout.position.y,
        z: Number((source.layout.position.z + 2).toFixed(3))
      }
    };
    const beforeSnapshot = captureHistorySnapshot();

    const didInstantiate = await instantiateRecord(duplicateRecord);
    if (!didInstantiate) {
      return;
    }

    state.statusMessage = `Duplicated ${getAssetLabel(assetDefinitions, duplicateRecord.assetId)}.`;
    pushUndoSnapshot(beforeSnapshot);
    setSelection(duplicateRecord.id);
  };

  const exportLayout = (): string => serializeBuilderLayout(state.layoutRecords.map(cloneLayoutRecord));

  const importLayout = async (
    input: string,
    options?: ImportLayoutOptions
  ): Promise<{ success: boolean; error?: string }> => {
    if (historyRestoreInFlight) {
      return {
        success: false,
        error: "History restore is in progress."
      };
    }

    const result = parseBuilderLayoutDocument(input);

    if (!result.success) {
      state.statusMessage = result.error;
      notify();
      return {
        success: false,
        error: result.error
      };
    }

    const beforeSnapshot = options?.recordHistory === false ? null : captureHistorySnapshot();
    clearAllObjects();

    let importedCount = 0;
    let skippedCount = 0;
    let firstImportedObjectId: string | null = null;
    const missingAssetIds = new Set<string>();
    const failedAssetLabels = new Set<string>();

    for (const record of result.value.objects.map(cloneLayoutRecord)) {
      const definition = assetDefinitions.get(record.assetId);
      if (!definition) {
        skippedCount += 1;
        missingAssetIds.add(record.assetId);
        continue;
      }

      const didInstantiate = await instantiateRecord(record);
      if (didInstantiate) {
        importedCount += 1;
        firstImportedObjectId ??= record.id;
      } else {
        skippedCount += 1;
        failedAssetLabels.add(definition.label);
      }

      const suffix = Number(record.id.split("-").at(-1));
      if (Number.isFinite(suffix)) {
        nextObjectNumber = Math.max(nextObjectNumber, suffix + 1);
      }
    }

    const missingSummary = Array.from(missingAssetIds);
    const failedSummary = Array.from(failedAssetLabels);
    const missingSuffix = missingSummary.length
      ? ` Missing: ${missingSummary.slice(0, 3).join(", ")}${missingSummary.length > 3 ? ", ..." : ""}.`
      : "";
    const failedSuffix = failedSummary.length
      ? ` Failed to load: ${failedSummary.slice(0, 3).join(", ")}${failedSummary.length > 3 ? ", ..." : ""}.`
      : "";

    state.statusMessage = skippedCount
      ? `Imported ${importedCount} object${importedCount === 1 ? "" : "s"}. Skipped ${skippedCount} unavailable asset${skippedCount === 1 ? "" : "s"}.${missingSuffix}${failedSuffix}`
      : `Imported ${importedCount} object${importedCount === 1 ? "" : "s"}.`;
    if (beforeSnapshot) {
      pushUndoSnapshot(beforeSnapshot);
    }
    setSelection(firstImportedObjectId);

    return {
      success: true
    };
  };

  const undo = async (): Promise<boolean> => {
    if (historyRestoreInFlight || undoStack.length === 0) {
      return false;
    }

    const targetSnapshot = undoStack.pop();
    if (!targetSnapshot) {
      return false;
    }

    const currentSnapshot = captureHistorySnapshot();
    redoStack.push(currentSnapshot);
    if (redoStack.length > HISTORY_LIMIT) {
      redoStack.shift();
    }

    historyRestoreInFlight = true;
    try {
      await restoreHistorySnapshot(targetSnapshot, { statusMessage: "Undo complete." });
      return true;
    } finally {
      historyRestoreInFlight = false;
    }
  };

  const redo = async (): Promise<boolean> => {
    if (historyRestoreInFlight || redoStack.length === 0) {
      return false;
    }

    const targetSnapshot = redoStack.pop();
    if (!targetSnapshot) {
      return false;
    }

    const currentSnapshot = captureHistorySnapshot();
    undoStack.push(currentSnapshot);
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.shift();
    }

    historyRestoreInFlight = true;
    try {
      await restoreHistorySnapshot(targetSnapshot, { statusMessage: "Redo complete." });
      return true;
    } finally {
      historyRestoreInFlight = false;
    }
  };

  const uploadAssets = async (
    files: File[],
    options?: {
      category?: string;
    }
  ): Promise<UploadedAssetBatchUploadResult> => {
    const category = normalizeUploadedAssetCategory(options?.category);
    const queuedFiles = files.filter((file): file is File => file instanceof File);
    if (queuedFiles.length === 0) {
      state.statusMessage = "No files selected for upload.";
      notify();
      return {
        category,
        failed: [],
        uploaded: []
      };
    }

    const uploaded: UploadedAssetUploadSuccess[] = [];
    const failed: UploadedAssetUploadFailure[] = [];

    for (const [index, file] of queuedFiles.entries()) {
      state.statusMessage = `Uploading ${file.name} (${index + 1}/${queuedFiles.length})...`;
      notify();

      let definition: AssetDefinition | null = null;

      try {
        definition = await saveUploadedAsset(file, { category });
        upsertAssetDefinition(definition);
        await assetLibrary.preloadAsset(definition.id);
        uploaded.push({
          assetId: definition.id,
          fileName: file.name,
          label: definition.label
        });
      } catch (error) {
        if (definition) {
          await deleteUploadedAsset(definition.id);
          await assetLibrary.evictAssets([definition.id]);
          removeAssetDefinition(definition.id);
        }

        failed.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : "Asset upload failed."
        });
      }
    }

    const uploadedCount = uploaded.length;
    const failedCount = failed.length;
    if (failedCount === 0) {
      state.statusMessage = `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"} to ${category}.`;
    } else if (uploadedCount === 0) {
      state.statusMessage =
        failedCount === 1
          ? failed[0].error
          : `Failed to upload ${failedCount} asset${failedCount === 1 ? "" : "s"}.`;
    } else {
      state.statusMessage = `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"}. ${failedCount} failed.`;
    }

    notify();
    return {
      category,
      failed,
      uploaded
    };
  };

  const uploadAsset = async (file: File): Promise<{ success: boolean; assetId?: AssetId; error?: string }> => {
    const result = await uploadAssets([file]);
    const uploadedAsset = result.uploaded[0];
    if (!uploadedAsset) {
      return {
        success: false,
        error: result.failed[0]?.error ?? "Asset upload failed."
      };
    }

    return {
      success: true,
      assetId: uploadedAsset.assetId
    };
  };

  const renameUploadedAssetCategory = async (
    assetId: AssetId,
    nextCategory: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existingDefinition = assetDefinitions.get(assetId);
    if (!existingDefinition || existingDefinition.source.type !== "uploaded") {
      return {
        success: false,
        error: "Only uploaded assets can be recategorized."
      };
    }

    try {
      const updatedDefinition = await renameUploadedAssetCategoryInStore(assetId, nextCategory);
      if (!updatedDefinition) {
        return {
          success: false,
          error: "Uploaded asset could not be found."
        };
      }
      if (updatedDefinition.source.type !== "uploaded") {
        return {
          success: false,
          error: "Uploaded asset metadata is invalid."
        };
      }

      upsertAssetDefinition(updatedDefinition);
      state.statusMessage = `Updated ${updatedDefinition.label} category to ${updatedDefinition.source.category}.`;
      notify();
      return {
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Uploaded asset category could not be updated.";
      state.statusMessage = message;
      notify();
      return {
        success: false,
        error: message
      };
    }
  };

  const pruneAssetFromHistorySnapshot = (
    snapshot: BuilderHistorySnapshot,
    assetId: AssetId
  ): BuilderHistorySnapshot => {
    const nextLayoutRecords = snapshot.layoutRecords
      .filter((record) => record.assetId !== assetId)
      .map(cloneLayoutRecord);
    const selectedObjectId =
      snapshot.selectedObjectId && nextLayoutRecords.some((record) => record.id === snapshot.selectedObjectId)
        ? snapshot.selectedObjectId
        : nextLayoutRecords[0]?.id ?? null;
    return {
      ...snapshot,
      layoutRecords: nextLayoutRecords,
      selectedObjectId
    };
  };

  const removeUploadedAsset = async (
    assetId: AssetId
  ): Promise<{ success: boolean; removedObjectCount: number; error?: string }> => {
    if (historyRestoreInFlight) {
      return {
        success: false,
        removedObjectCount: 0,
        error: "History restore is in progress."
      };
    }

    const definition = assetDefinitions.get(assetId);
    if (!definition || definition.source.type !== "uploaded") {
      return {
        success: false,
        removedObjectCount: 0,
        error: "Only uploaded assets can be removed individually."
      };
    }

    const affectedObjectIds = state.layoutRecords
      .filter((record) => record.assetId === assetId)
      .map((record) => record.id);
    for (const objectId of affectedObjectIds) {
      deleteObjectByIdInternal(objectId, { recordHistory: false });
    }

    try {
      await deleteUploadedAsset(assetId);
      await assetLibrary.evictAssets([assetId]);
      removeAssetDefinition(assetId);

      undoStack = undoStack.map((snapshot) => pruneAssetFromHistorySnapshot(snapshot, assetId));
      redoStack = redoStack.map((snapshot) => pruneAssetFromHistorySnapshot(snapshot, assetId));

      const removedObjectCount = affectedObjectIds.length;
      const removedObjectSuffix =
        removedObjectCount > 0
          ? ` Removed ${removedObjectCount} placed instance${removedObjectCount === 1 ? "" : "s"}.`
          : "";
      state.statusMessage = `Removed uploaded asset ${definition.label}.${removedObjectSuffix}`;
      notify();
      return {
        success: true,
        removedObjectCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Uploaded asset could not be removed.";
      state.statusMessage = message;
      notify();
      return {
        success: false,
        removedObjectCount: 0,
        error: message
      };
    }
  };

  scene.onPointerObservable.add((pointerInfo) => {
    const pointerEvent = pointerInfo.event as PointerEvent | undefined;

    if (historyRestoreInFlight) {
      return;
    }

    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
      return;
    }

    if (suppressNextPick) {
      suppressNextPick = false;
      return;
    }

    if (pointerEvent?.button !== 0) {
      return;
    }

    if (gizmoManager.isDragging || gizmoManager.isHovered) {
      return;
    }

    const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
    setSelection(resolveObjectIdForMesh(pickedMesh));
  });

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.key.toLowerCase() !== "r") {
      return;
    }

    developmentCamera.resetOverview(true);
  };

  type BuilderDebugApi = {
    applySelectedRootDeltaForTest: (delta: { x?: number; y?: number; z?: number }) => boolean;
    beginGizmoInteractionForTest: () => void;
    completeGizmoInteractionForTest: () => void;
    getState: () => {
      attachedNodeName: string | null;
      attachedNodeMatchesSelectionRoot: boolean;
      cameraNavigationEnabled: boolean;
      gizmoDragging: boolean;
      gizmoHovering: boolean;
      selectedMaterialStates: Array<{
        materialDisposed: boolean;
        materialName: string | null;
        textureDisposed: boolean;
        texturePresent: boolean;
      }>;
      selectedMeshBoundingBoxes: boolean[];
      selectedObjectId: string | null;
      transformMode: BuilderTransformMode;
    };
  };

  let debugApi: BuilderDebugApi | null = null;
  if (isBrowserDebugEnabled() && typeof window !== "undefined") {
    debugApi = {
      applySelectedRootDeltaForTest: (delta) => {
        if (!state.selectedObjectId) {
          return false;
        }

        const entry = placedObjects.get(state.selectedObjectId);
        if (!entry) {
          return false;
        }

        entry.root.position.x += delta.x ?? 0;
        entry.root.position.y += delta.y ?? 0;
        entry.root.position.z += delta.z ?? 0;
        return true;
      },
      beginGizmoInteractionForTest: () => {
        beginGizmoInteraction();
      },
      completeGizmoInteractionForTest: () => {
        completeGizmoInteraction();
      },
      getState: () => {
        const selectedEntry = state.selectedObjectId ? placedObjects.get(state.selectedObjectId) : null;
        const selectedMaterialStates = selectedEntry
          ? selectedEntry.meshes.map((mesh) => {
              const meshMaterial = mesh.material as {
                getClassName?: () => string;
                isDisposed?: () => boolean;
                name?: string;
                diffuseTexture?: { isDisposed?: () => boolean } | null;
                albedoTexture?: { isDisposed?: () => boolean } | null;
                baseTexture?: { isDisposed?: () => boolean } | null;
              } | null;
              const diffuseTexture = meshMaterial?.diffuseTexture ?? null;
              const albedoTexture = meshMaterial?.albedoTexture ?? null;
              const baseTexture = meshMaterial?.baseTexture ?? null;
              const resolvedTexture = albedoTexture ?? diffuseTexture ?? baseTexture;
              return {
                materialDisposed: Boolean(meshMaterial?.isDisposed?.()),
                materialName: meshMaterial?.name ?? null,
                textureDisposed: Boolean(resolvedTexture?.isDisposed?.()),
                texturePresent: Boolean(resolvedTexture)
              };
            })
          : [];
        return {
          attachedNodeName: gizmoManager.attachedNode?.name ?? null,
          attachedNodeMatchesSelectionRoot: Boolean(
            selectedEntry && gizmoManager.attachedNode === selectedEntry.root
          ),
          cameraNavigationEnabled: developmentCamera.isNavigationEnabled(),
          gizmoDragging: gizmoManager.isDragging,
          gizmoHovering: gizmoManager.isHovered,
          selectedMaterialStates,
          selectedMeshBoundingBoxes: selectedEntry?.meshes.map((mesh) => mesh.showBoundingBox) ?? [],
          selectedObjectId: state.selectedObjectId,
          transformMode
        };
      }
    };

    const debugWindow = window as Window & { __skillGardenBuilderDebug?: BuilderDebugApi };
    debugWindow.__skillGardenBuilderDebug = debugApi;
  }

  window.addEventListener("keydown", handleKeyDown);
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", handleKeyDown);
    if (typeof window !== "undefined" && debugApi) {
      const debugWindow = window as Window & { __skillGardenBuilderDebug?: BuilderDebugApi };
      if (debugWindow.__skillGardenBuilderDebug === debugApi) {
        delete debugWindow.__skillGardenBuilderDebug;
      }
    }
    clearAllObjects();
    assetLibrary.dispose();
    gizmoManager.dispose();
    selectionController.dispose();
    developmentCamera.dispose();
  });

  state.isReady = true;
  state.statusMessage = "Builder ready. Camera is locked for object editing; enable camera mode in the top toolbar when needed.";
  logSceneSnapshot("ready");

  return {
    scene,
    deleteSelectedObject,
    deleteObjectById,
    duplicateSelectedObject,
    exportLayout,
    getSnapshot,
    importLayout,
    isCameraNavigationEnabled: () => developmentCamera.isNavigationEnabled(),
    getTransformMode: () => transformMode,
    placeAsset,
    redo,
    selectObjectById,
    setCameraNavigationEnabled,
    setTransformMode,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearUploads,
    undo,
    uploadAssets,
    uploadAsset,
    renameUploadedAssetCategory,
    removeUploadedAsset,
    updateSelectedTransform
  };
}
