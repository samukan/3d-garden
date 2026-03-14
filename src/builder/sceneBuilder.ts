import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

import { createCameraRoutePlayer } from "../camera-routes/cameraRoutePlayer";
import type { CameraRouteDefinition, CameraRoutePoint } from "../camera-routes/cameraRouteTypes";
import { createDevelopmentCamera } from "../engine/developmentCamera";
import { createAssetDefinitionMap, getAssetLabel, loadAssetDefinitions } from "../generation/assetCatalog";
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";
import type { AssetDefinition, AssetId } from "../generation/natureKitAssetManifest";
import {
  clearUploadedAssets,
  deleteUploadedAsset,
  listUploadedAssetSnapshots,
  normalizeUploadedAssetCategory,
  renameUploadedAssetCategory as renameUploadedAssetCategoryInStore,
  saveUploadedAsset
} from "../storage/uploadedAssetStore";
import { degreesToRadians, radiansToDegrees } from "../utils/angle";
import { isBrowserDebugEnabled, logBrowserDebug } from "../utils/browserDebug";
import { enableMeshVertexColors } from "../utils/meshColors";
import { createWorldPackageFile, importWorldPackageFile } from "../world-package/worldPackageIO";
import { getBuilderPalette } from "./builderPalette";
import {
  cloneBuilderWorldMetadata,
  parseBuilderLayoutDocument,
  serializeBuilderLayout
} from "./sceneLayoutSerializer";
import { createBuilderSceneState } from "./sceneBuilderState";
import type {
  BuilderLayoutRecord,
  BuilderPaletteItem,
  BuilderRouteEditState,
  BuilderRoutePointMoveDirection,
  BuilderRouteSettingsPatch,
  BuilderSceneSnapshot,
  BuilderSelectedObjectSnapshot,
  BuilderVector3,
  BuilderWorldCameraRoutesMetadata,
  BuilderWorldMetadata
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
export type BuilderSelectionMergeMode = "replace" | "add" | "toggle";

export interface BuilderScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SceneBuilderController {
  scene: Scene;
  setRouteModeEnabled: (enabled: boolean) => void;
  getRouteEditState: () => BuilderRouteEditState;
  createRoute: (name?: string) => string | null;
  selectRoute: (routeId: string | null) => void;
  deleteRoute: (routeId: string) => boolean;
  setDefaultRoute: (routeId: string | null) => void;
  addPointFromCurrentCamera: (dwellMs?: number) => boolean;
  selectRoutePoint: (pointIndex: number | null) => void;
  removePoint: (pointIndex: number) => boolean;
  movePoint: (pointIndex: number, direction: BuilderRoutePointMoveDirection) => boolean;
  updateRouteSettings: (patch: BuilderRouteSettingsPatch) => boolean;
  previewSelectedRoute: () => boolean;
  stopRoutePreview: (options?: { resetToStart?: boolean }) => void;
  deleteSelectedObject: () => void;
  deleteObjectById: (objectId: string) => void;
  duplicateSelectedObject: () => Promise<void>;
  exportLayout: () => string;
  exportWorldPackage: (worldName: string) => Promise<{
    fileName: string;
    blob: Blob;
    objectCount: number;
    uploadedAssetCount: number;
  }>;
  getSnapshot: () => BuilderSceneSnapshot;
  importWorldPackage: (
    file: File
  ) => Promise<{ success: boolean; uploadedAssetCount?: number; remappedAssetCount?: number; error?: string }>;
  importLayout: (input: string, options?: ImportLayoutOptions) => Promise<{ success: boolean; error?: string }>;
  isCameraNavigationEnabled: () => boolean;
  getTransformMode: () => BuilderTransformMode;
  placeAsset: (assetId: AssetId) => Promise<void>;
  canStartMarqueeSelectionAt: (clientX: number, clientY: number) => boolean;
  applyMarqueeSelection: (rect: BuilderScreenRect, mode: BuilderSelectionMergeMode) => void;
  replaceSelection: (objectIds: string[], primaryObjectId?: string | null) => void;
  addToSelection: (objectId: string) => void;
  toggleSelection: (objectId: string) => void;
  removeFromSelection: (objectId: string) => void;
  clearSelection: () => void;
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
  layoutMetadata: BuilderWorldMetadata | undefined;
  nextObjectNumber: number;
  selectedObjectIds: string[];
  primarySelectedObjectId: string | null;
  selectedObjectId?: string | null;
}

interface BuilderGizmoInteractionState {
  beforeSnapshot: BuilderHistorySnapshot;
  cameraNavigationEnabledBefore: boolean;
  objectId: string;
  objectIds: string[];
  interactionKind: "single" | "group-move" | "group-rotate" | "group-scale";
  groupMovePivotNode: TransformNode | null;
  groupMoveStartPivotPosition: Vector3 | null;
  groupStartPivotRotationY: number | null;
  groupStartPivotScale: number | null;
  groupMoveStartRootPositions: Map<string, Vector3>;
  groupStartRootRotationY: Map<string, number>;
  groupStartRootScale: Map<string, number>;
}

interface RouteOverlayMaterials {
  defaultPoint: StandardMaterial;
  selectedPoint: StandardMaterial;
}

const HISTORY_LIMIT = 100;
const ROUTE_POINT_SPHERE_SIZE = 0.5;
const ROUTE_POINT_SELECTED_SPHERE_SIZE = 0.78;
const ROUTE_DEFAULT_DURATION_MS = 7000;

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
  let routeModeEnabled = false;
  let selectedRouteId: string | null = null;
  let selectedRoutePointIndex: number | null = null;
  let routePreviewPlaying = false;
  let routePreviewCameraNavigationBefore: boolean | null = null;
  let routeOverlayMaterials: RouteOverlayMaterials | null = null;
  let routeOverlayPointMeshes: Mesh[] = [];
  let routeOverlayLine: LinesMesh | null = null;
  let routeOverlayLookAtLine: LinesMesh | null = null;
  let multiSelectionTransformPivotNode: TransformNode | null = null;

  scene.clearColor = new Color4(0.79, 0.87, 0.92, 1);
  scene.ambientColor = new Color3(0.2, 0.24, 0.22);
  scene.fogMode = Scene.FOGMODE_NONE;

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

  const cloneCameraRoute = (route: CameraRouteDefinition): CameraRouteDefinition => ({
    id: route.id,
    name: route.name,
    loop: route.loop,
    timing: route.timing.mode === "duration"
      ? {
          mode: "duration",
          totalDurationMs: route.timing.totalDurationMs
        }
      : {
          mode: "speed",
          unitsPerSecond: route.timing.unitsPerSecond
        },
    easing: route.easing,
    points: route.points.map((point) => ({
      position: [...point.position] as [number, number, number],
      lookAt: [...point.lookAt] as [number, number, number],
      dwellMs: point.dwellMs
    }))
  });

  const getCameraRoutesMetadata = (): BuilderWorldCameraRoutesMetadata | undefined => state.layoutMetadata?.cameraRoutes;

  const cleanupEmptyMetadata = (): void => {
    const metadata = state.layoutMetadata;
    if (!metadata) {
      return;
    }

    if (!metadata.cameraRoutes) {
      state.layoutMetadata = undefined;
    }
  };

  const ensureLayoutMetadata = (): BuilderWorldMetadata => {
    if (!state.layoutMetadata) {
      state.layoutMetadata = {};
    }
    return state.layoutMetadata;
  };

  const ensureCameraRoutesMetadata = (): BuilderWorldCameraRoutesMetadata => {
    const metadata = ensureLayoutMetadata();
    if (!metadata.cameraRoutes) {
      metadata.cameraRoutes = {
        routes: []
      };
    }
    return metadata.cameraRoutes;
  };

  const getSelectedRouteMetadata = (): CameraRouteDefinition | null => {
    const metadata = getCameraRoutesMetadata();
    if (!metadata || !selectedRouteId) {
      return null;
    }

    return metadata.routes.find((route) => route.id === selectedRouteId) ?? null;
  };

  const normalizeSelectedPointIndex = (): void => {
    const selectedRoute = getSelectedRouteMetadata();
    if (!selectedRoute || selectedRoute.points.length === 0) {
      selectedRoutePointIndex = null;
      return;
    }

    if (selectedRoutePointIndex === null) {
      return;
    }

    if (selectedRoutePointIndex < 0 || selectedRoutePointIndex >= selectedRoute.points.length) {
      selectedRoutePointIndex = selectedRoute.points.length - 1;
    }
  };

  const reconcileRouteSelection = (): void => {
    const metadata = getCameraRoutesMetadata();
    if (!metadata || metadata.routes.length === 0) {
      selectedRouteId = null;
      selectedRoutePointIndex = null;
      return;
    }

    const selectedRouteExists = selectedRouteId
      ? metadata.routes.some((route) => route.id === selectedRouteId)
      : false;
    if (!selectedRouteExists) {
      selectedRouteId = metadata.routes[0]?.id ?? null;
    }

    if (metadata.defaultRouteId && !metadata.routes.some((route) => route.id === metadata.defaultRouteId)) {
      metadata.defaultRouteId = metadata.routes[0]?.id;
    }

    normalizeSelectedPointIndex();
  };

  const createRouteOverlayMaterials = (): RouteOverlayMaterials => {
    const defaultPointMaterial = new StandardMaterial("builder-route-point-material", scene);
    defaultPointMaterial.disableLighting = true;
    defaultPointMaterial.emissiveColor = new Color3(0.88, 0.73, 0.18);
    defaultPointMaterial.diffuseColor = new Color3(0.88, 0.73, 0.18);
    defaultPointMaterial.specularColor = Color3.Black();

    const selectedPointMaterial = new StandardMaterial("builder-route-point-selected-material", scene);
    selectedPointMaterial.disableLighting = true;
    selectedPointMaterial.emissiveColor = new Color3(0.2, 0.86, 0.98);
    selectedPointMaterial.diffuseColor = new Color3(0.2, 0.86, 0.98);
    selectedPointMaterial.specularColor = Color3.Black();

    return {
      defaultPoint: defaultPointMaterial,
      selectedPoint: selectedPointMaterial
    };
  };

  const ensureRouteOverlayMaterials = (): RouteOverlayMaterials => {
    if (!routeOverlayMaterials) {
      routeOverlayMaterials = createRouteOverlayMaterials();
    }
    return routeOverlayMaterials;
  };

  const disposeRouteOverlay = (): void => {
    for (const mesh of routeOverlayPointMeshes) {
      mesh.dispose(false, true);
    }
    routeOverlayPointMeshes = [];
    routeOverlayLine?.dispose(false, true);
    routeOverlayLine = null;
    routeOverlayLookAtLine?.dispose(false, true);
    routeOverlayLookAtLine = null;
  };

  const updateRouteOverlay = (): void => {
    disposeRouteOverlay();

    if (!routeModeEnabled) {
      return;
    }

    const selectedRoute = getSelectedRouteMetadata();
    if (!selectedRoute || selectedRoute.points.length === 0) {
      return;
    }

    const materials = ensureRouteOverlayMaterials();
    const pathPoints: Vector3[] = [];
    selectedRoute.points.forEach((point, pointIndex) => {
      const pointPosition = new Vector3(point.position[0], point.position[1], point.position[2]);
      pathPoints.push(pointPosition);
      const isSelectedPoint = selectedRoutePointIndex === pointIndex;
      const sphere = MeshBuilder.CreateSphere(
        `builder-route-point-${selectedRoute.id}-${pointIndex}`,
        {
          diameter: isSelectedPoint ? ROUTE_POINT_SELECTED_SPHERE_SIZE : ROUTE_POINT_SPHERE_SIZE,
          segments: 8
        },
        scene
      );
      sphere.position.copyFrom(pointPosition);
      sphere.material = isSelectedPoint ? materials.selectedPoint : materials.defaultPoint;
      sphere.isPickable = false;
      sphere.alwaysSelectAsActiveMesh = true;
      sphere.renderingGroupId = 2;
      routeOverlayPointMeshes.push(sphere);
    });

    if (pathPoints.length >= 2) {
      routeOverlayLine = MeshBuilder.CreateLines(
        "builder-route-path-line",
        {
          points: pathPoints
        },
        scene
      );
      routeOverlayLine.color = new Color3(0.32, 0.78, 0.96);
      routeOverlayLine.isPickable = false;
      routeOverlayLine.alwaysSelectAsActiveMesh = true;
      routeOverlayLine.renderingGroupId = 2;
    }

    if (selectedRoutePointIndex !== null) {
      const selectedPoint = selectedRoute.points[selectedRoutePointIndex];
      if (selectedPoint) {
        routeOverlayLookAtLine = MeshBuilder.CreateLines(
          "builder-route-look-at-line",
          {
            points: [
              new Vector3(selectedPoint.position[0], selectedPoint.position[1], selectedPoint.position[2]),
              new Vector3(selectedPoint.lookAt[0], selectedPoint.lookAt[1], selectedPoint.lookAt[2])
            ]
          },
          scene
        );
        routeOverlayLookAtLine.color = new Color3(0.98, 0.35, 0.52);
        routeOverlayLookAtLine.isPickable = false;
        routeOverlayLookAtLine.alwaysSelectAsActiveMesh = true;
        routeOverlayLookAtLine.renderingGroupId = 2;
      }
    }
  };

  const stopRoutePreviewInternal = (
    options: { resetToStart?: boolean; statusMessage?: string; notifyAfter?: boolean } = {}
  ): void => {
    routePlayer.stop({
      resetToStart: options.resetToStart
    });
    if (routePreviewCameraNavigationBefore !== null) {
      developmentCamera.setNavigationEnabled(routePreviewCameraNavigationBefore);
      routePreviewCameraNavigationBefore = null;
    }
    if (!routePreviewPlaying && !options.statusMessage) {
      return;
    }
    routePreviewPlaying = false;
    if (options.statusMessage) {
      state.statusMessage = options.statusMessage;
    }
    if (options.notifyAfter !== false) {
      notify();
    }
  };

  const routePlayer = createCameraRoutePlayer({
    scene,
    camera: developmentCamera.camera,
    onRouteComplete: () => {
      stopRoutePreviewInternal({
        statusMessage: "Route preview completed."
      });
    }
  });

  const cloneRouteEditState = (): BuilderRouteEditState => {
    const metadata = getCameraRoutesMetadata();
    return {
      routeModeEnabled,
      selectedRouteId,
      selectedPointIndex: selectedRoutePointIndex,
      isPreviewPlaying: routePreviewPlaying && routePlayer.isPlaying(),
      defaultRouteId: metadata?.defaultRouteId ?? null,
      routes: metadata?.routes.map((route) => cloneCameraRoute(route)) ?? []
    };
  };

  const applyRouteMetadataChange = (
    mutator: (metadata: BuilderWorldCameraRoutesMetadata) => boolean,
    statusMessage: string
  ): boolean => {
    const beforeSnapshot = captureHistorySnapshot();
    const metadata = ensureCameraRoutesMetadata();
    const didChange = mutator(metadata);
    if (!didChange) {
      cleanupEmptyMetadata();
      return false;
    }

    pushUndoSnapshot(beforeSnapshot);
    reconcileRouteSelection();
    updateRouteOverlay();
    if (routePreviewPlaying) {
      stopRoutePreviewInternal({
        statusMessage: "Route preview stopped because the route was updated.",
        notifyAfter: false
      });
    }
    state.statusMessage = statusMessage;
    notify();
    return true;
  };

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
    layoutMetadata: cloneBuilderWorldMetadata(state.layoutMetadata),
    nextObjectNumber,
    selectedObjectIds: [...state.selectedObjectIds],
    primarySelectedObjectId: state.primarySelectedObjectId
  });

  const getPrimarySelectedObjectId = (): string | null => state.primarySelectedObjectId;

  const deriveCompatibilitySelectedObjectId = (): string | null => state.primarySelectedObjectId;

  const normalizeSelectionIds = (ids: string[]): string[] => {
    const uniqueIds: string[] = [];
    const seenIds = new Set<string>();
    for (const id of ids) {
      if (!placedObjects.has(id) || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      uniqueIds.push(id);
    }

    return uniqueIds;
  };

  const resolvePrimarySelectionId = (orderedIds: string[], preferredPrimaryId?: string | null): string | null => {
    if (orderedIds.length === 0) {
      return null;
    }

    if (preferredPrimaryId && orderedIds.includes(preferredPrimaryId)) {
      return preferredPrimaryId;
    }

    return orderedIds[orderedIds.length - 1] ?? null;
  };

  const applySelectionState = (
    orderedIds: string[],
    preferredPrimaryId?: string | null,
    options?: { notify?: boolean }
  ): void => {
    const normalizedIds = normalizeSelectionIds(orderedIds);
    const nextPrimaryId = resolvePrimarySelectionId(normalizedIds, preferredPrimaryId);

    state.selectedObjectIds = normalizedIds;
    state.primarySelectedObjectId = nextPrimaryId;
    state.selectedObjectId = deriveCompatibilitySelectedObjectId();

    const selectedMeshes = normalizedIds.flatMap((id) => placedObjects.get(id)?.meshes ?? []);
    selectionController.setSelection(selectedMeshes);
    setGizmoAttachmentForSelection();

    if (options?.notify !== false) {
      notify();
    }
  };

  const replaceSelection = (objectIds: string[], primaryObjectId?: string | null): void => {
    applySelectionState(objectIds, primaryObjectId);
  };

  const addToSelection = (objectId: string): void => {
    if (!placedObjects.has(objectId)) {
      return;
    }

    if (state.selectedObjectIds.includes(objectId)) {
      applySelectionState(state.selectedObjectIds, objectId);
      return;
    }

    applySelectionState([...state.selectedObjectIds, objectId], objectId);
  };

  const removeFromSelection = (objectId: string): void => {
    if (!state.selectedObjectIds.includes(objectId)) {
      return;
    }

    const nextSelectionIds = state.selectedObjectIds.filter((id) => id !== objectId);
    const nextPrimaryId =
      state.primarySelectedObjectId === objectId
        ? nextSelectionIds[nextSelectionIds.length - 1] ?? null
        : state.primarySelectedObjectId;
    applySelectionState(nextSelectionIds, nextPrimaryId);
  };

  const toggleSelection = (objectId: string): void => {
    if (!placedObjects.has(objectId)) {
      return;
    }

    if (state.selectedObjectIds.includes(objectId)) {
      removeFromSelection(objectId);
      return;
    }

    addToSelection(objectId);
  };

  const clearSelection = (): void => {
    applySelectionState([], null);
  };

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
    const disposeMultiSelectionTransformPivotNode = (): void => {
      if (!multiSelectionTransformPivotNode) {
        return;
      }

      if (gizmoManager.attachedNode === multiSelectionTransformPivotNode) {
        gizmoManager.attachToNode(null);
      }

      multiSelectionTransformPivotNode.dispose(false, true);
      multiSelectionTransformPivotNode = null;
    };

    const getSelectedEntriesInOrder = (): PlacedObjectEntry[] => state.selectedObjectIds
      .map((id) => placedObjects.get(id))
      .filter((entry): entry is PlacedObjectEntry => Boolean(entry));

    const getSelectionCentroid = (entries: PlacedObjectEntry[]): Vector3 | null => {
      if (entries.length === 0) {
        return null;
      }

      const accumulated = new Vector3(0, 0, 0);
      for (const entry of entries) {
        accumulated.addInPlace(entry.root.position);
      }

      return accumulated.scale(1 / entries.length);
    };

    const ensureMultiSelectionTransformPivotNode = (): TransformNode | null => {
      if (transformMode !== "move" && transformMode !== "rotate" && transformMode !== "scale") {
        disposeMultiSelectionTransformPivotNode();
        return null;
      }

      const selectedEntries = getSelectedEntriesInOrder();
      if (selectedEntries.length < 2) {
        disposeMultiSelectionTransformPivotNode();
        return null;
      }

      const centroid = getSelectionCentroid(selectedEntries);
      if (!centroid) {
        disposeMultiSelectionTransformPivotNode();
        return null;
      }

      if (!multiSelectionTransformPivotNode || multiSelectionTransformPivotNode.isDisposed()) {
        multiSelectionTransformPivotNode = new TransformNode("builder-multi-selection-transform-pivot", scene);
      }

      multiSelectionTransformPivotNode.position.copyFrom(centroid);
      multiSelectionTransformPivotNode.rotation.set(0, 0, 0);
      multiSelectionTransformPivotNode.scaling.set(1, 1, 1);
      return multiSelectionTransformPivotNode;
    };

    const selectedObjectIds = state.selectedObjectIds;
    if (selectedObjectIds.length > 1) {
      const multiSelectionPivotNode = ensureMultiSelectionTransformPivotNode();
      if (multiSelectionPivotNode) {
        gizmoManager.attachToNode(multiSelectionPivotNode);
        return;
      }
    }

    disposeMultiSelectionTransformPivotNode();

    const selectedObjectId = getPrimarySelectedObjectId();
    if (!selectedObjectId) {
      gizmoManager.attachToNode(null);
      return;
    }

    const selectedEntry = placedObjects.get(selectedObjectId);
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
    const selectedObjectId = getPrimarySelectedObjectId();
    if (historyRestoreInFlight || gizmoInteractionState || !selectedObjectId) {
      return;
    }

    const selectedObjectIds = normalizeSelectionIds(state.selectedObjectIds);
    const canUseGroupTransformInteraction =
      (transformMode === "move" || transformMode === "rotate" || transformMode === "scale") &&
      selectedObjectIds.length > 1;
    const selectedEntries = selectedObjectIds
      .map((id) => placedObjects.get(id))
      .filter((entry): entry is PlacedObjectEntry => Boolean(entry));

    const groupMovePivotNode = canUseGroupTransformInteraction && gizmoManager.attachedNode instanceof TransformNode
      ? gizmoManager.attachedNode
      : null;

    const groupMoveStartRootPositions = new Map<string, Vector3>();
    const groupStartRootRotationY = new Map<string, number>();
    const groupStartRootScale = new Map<string, number>();
    if (canUseGroupTransformInteraction) {
      for (const entry of selectedEntries) {
        groupMoveStartRootPositions.set(entry.layout.id, entry.root.position.clone());
        groupStartRootRotationY.set(entry.layout.id, entry.root.rotation.y);
        groupStartRootScale.set(entry.layout.id, entry.root.scaling.x);
      }
    }

    const interactionKind: BuilderGizmoInteractionState["interactionKind"] =
      canUseGroupTransformInteraction && groupMovePivotNode
        ? transformMode === "rotate"
          ? "group-rotate"
          : transformMode === "scale"
            ? "group-scale"
            : "group-move"
        : "single";

    gizmoInteractionState = {
      beforeSnapshot: captureHistorySnapshot(),
      cameraNavigationEnabledBefore: developmentCamera.isNavigationEnabled(),
      objectId: selectedObjectId,
      objectIds: canUseGroupTransformInteraction ? selectedEntries.map((entry) => entry.layout.id) : [selectedObjectId],
      interactionKind,
      groupMovePivotNode,
      groupMoveStartPivotPosition: canUseGroupTransformInteraction && groupMovePivotNode
        ? groupMovePivotNode.position.clone()
        : null,
      groupStartPivotRotationY: canUseGroupTransformInteraction && groupMovePivotNode
        ? groupMovePivotNode.rotation.y
        : null,
      groupStartPivotScale: canUseGroupTransformInteraction && groupMovePivotNode
        ? groupMovePivotNode.scaling.x
        : null,
      groupMoveStartRootPositions,
      groupStartRootRotationY,
      groupStartRootScale
    };

    if (developmentCamera.isNavigationEnabled()) {
      developmentCamera.setNavigationEnabled(false);
    }

    state.statusMessage = gizmoInteractionState.interactionKind === "group-move"
      ? `Transforming ${gizmoInteractionState.objectIds.length} selected objects...`
      : gizmoInteractionState.interactionKind === "group-rotate"
        ? `Rotating ${gizmoInteractionState.objectIds.length} selected objects...`
        : gizmoInteractionState.interactionKind === "group-scale"
          ? `Scaling ${gizmoInteractionState.objectIds.length} selected objects...`
        : "Transforming selected object...";
    suppressNextPick = true;
    notify();
  };

  const applyGroupMoveDuringInteraction = (interactionState: BuilderGizmoInteractionState): void => {
    if (
      interactionState.interactionKind !== "group-move" ||
      !interactionState.groupMovePivotNode ||
      !interactionState.groupMoveStartPivotPosition
    ) {
      return;
    }

    const delta = interactionState.groupMovePivotNode.position.subtract(interactionState.groupMoveStartPivotPosition);
    for (const objectId of interactionState.objectIds) {
      const entry = placedObjects.get(objectId);
      const startRootPosition = interactionState.groupMoveStartRootPositions.get(objectId);
      if (!entry || !startRootPosition) {
        continue;
      }

      entry.root.position.set(
        startRootPosition.x + delta.x,
        startRootPosition.y + delta.y,
        startRootPosition.z + delta.z
      );
    }
  };

  const applyGroupRotateDuringInteraction = (interactionState: BuilderGizmoInteractionState): void => {
    if (
      interactionState.interactionKind !== "group-rotate" ||
      !interactionState.groupMovePivotNode ||
      interactionState.groupStartPivotRotationY === null
    ) {
      return;
    }

    const pivotNode = interactionState.groupMovePivotNode;
    const rotationDeltaY = pivotNode.rotation.y - interactionState.groupStartPivotRotationY;

    for (const objectId of interactionState.objectIds) {
      const entry = placedObjects.get(objectId);
      const startRootRotationY = interactionState.groupStartRootRotationY.get(objectId);
      if (!entry || startRootRotationY === undefined) {
        continue;
      }

      entry.root.rotation.y = startRootRotationY + rotationDeltaY;
    }
  };

  const applyGroupScaleDuringInteraction = (interactionState: BuilderGizmoInteractionState): void => {
    if (
      interactionState.interactionKind !== "group-scale" ||
      !interactionState.groupMovePivotNode ||
      interactionState.groupStartPivotScale === null ||
      interactionState.groupStartPivotScale <= 0
    ) {
      return;
    }

    const pivotNode = interactionState.groupMovePivotNode;
    const rawScaleRatio = pivotNode.scaling.x / interactionState.groupStartPivotScale;
    const safeScaleRatio = Number.isFinite(rawScaleRatio) && rawScaleRatio > 0.0001 ? rawScaleRatio : 0.0001;

    for (const objectId of interactionState.objectIds) {
      const entry = placedObjects.get(objectId);
      const startRootScale = interactionState.groupStartRootScale.get(objectId);
      if (!entry || startRootScale === undefined) {
        continue;
      }

      const nextUniformScale = Math.max(0.0001, startRootScale * safeScaleRatio);
      entry.root.scaling.set(nextUniformScale, nextUniformScale, nextUniformScale);
    }
  };

  const completeGizmoInteraction = (): void => {
    if (!gizmoInteractionState) {
      return;
    }

    const interactionState = gizmoInteractionState;
    gizmoInteractionState = null;

    let didChange = false;
    if (interactionState.interactionKind === "group-move") {
      applyGroupMoveDuringInteraction(interactionState);
      for (const objectId of interactionState.objectIds) {
        const entry = placedObjects.get(objectId);
        if (!entry) {
          continue;
        }

        const didUpdate = updateObjectTransform(
          objectId,
          {
            position: {
              x: Number(entry.root.position.x.toFixed(3)),
              y: Number(entry.root.position.y.toFixed(3)),
              z: Number(entry.root.position.z.toFixed(3))
            }
          },
          { silentStatus: true }
        );
        didChange = didUpdate || didChange;
      }

      if (didChange) {
        pushUndoSnapshot(interactionState.beforeSnapshot);
        state.statusMessage = `Moved ${interactionState.objectIds.length} selected objects.`;
      } else {
        state.statusMessage = "Transform unchanged.";
      }
    } else if (interactionState.interactionKind === "group-rotate") {
      applyGroupRotateDuringInteraction(interactionState);
      for (const objectId of interactionState.objectIds) {
        const didUpdate = updateLayoutFromRootNode(objectId, { silentStatus: true });
        didChange = didUpdate || didChange;
      }

      if (didChange) {
        pushUndoSnapshot(interactionState.beforeSnapshot);
        state.statusMessage = `Rotated ${interactionState.objectIds.length} selected objects.`;
      } else {
        state.statusMessage = "Transform unchanged.";
      }
    } else if (interactionState.interactionKind === "group-scale") {
      applyGroupScaleDuringInteraction(interactionState);
      for (const objectId of interactionState.objectIds) {
        const didUpdate = updateLayoutFromRootNode(objectId, { silentStatus: true });
        didChange = didUpdate || didChange;
      }

      if (didChange) {
        pushUndoSnapshot(interactionState.beforeSnapshot);
        state.statusMessage = `Scaled ${interactionState.objectIds.length} selected objects.`;
      } else {
        state.statusMessage = "Transform unchanged.";
      }
    } else {
      didChange = updateLayoutFromRootNode(interactionState.objectId, { silentStatus: true });
      if (didChange) {
        pushUndoSnapshot(interactionState.beforeSnapshot);
        const entry = placedObjects.get(interactionState.objectId);
        if (entry) {
          state.statusMessage = `Transformed ${getAssetLabel(assetDefinitions, entry.layout.assetId)}.`;
        }
      } else {
        state.statusMessage = "Transform unchanged.";
      }
    }

    restoreCameraNavigationState(interactionState.cameraNavigationEnabledBefore);
    setGizmoAttachmentForSelection();
    notify();
  };

  const cancelGizmoInteraction = (): void => {
    if (!gizmoInteractionState) {
      return;
    }

    const cameraNavigationEnabledBefore = gizmoInteractionState.cameraNavigationEnabledBefore;
    gizmoInteractionState = null;
    restoreCameraNavigationState(cameraNavigationEnabledBefore);
    setGizmoAttachmentForSelection();
  };

  const getSelectedObjectSnapshot = (): BuilderSelectedObjectSnapshot | null => {
    const selectedObjectId = getPrimarySelectedObjectId();
    if (!selectedObjectId) {
      return null;
    }

    const entry = placedObjects.get(selectedObjectId);
    if (!entry) {
      return null;
    }

    return {
      ...cloneLayoutRecord(entry.layout),
      assetLabel: getAssetLabel(assetDefinitions, entry.layout.assetId)
    };
  };

  const getSnapshot = (): BuilderSceneSnapshot => {
    const primarySelectedObject = getSelectedObjectSnapshot();

    return {
      isReady: state.isReady,
      palette,
      objects: state.layoutRecords.map((record) => ({
        ...cloneLayoutRecord(record),
        assetLabel: getAssetLabel(assetDefinitions, record.assetId)
      })),
      selectedObjectIds: [...state.selectedObjectIds],
      primarySelectedObjectId: state.primarySelectedObjectId,
      primarySelectedObject,
      selectedObjectId: deriveCompatibilitySelectedObjectId(),
      selectedObject: primarySelectedObject,
      statusMessage: state.statusMessage
    };
  };

  const setCameraNavigationEnabled = (enabled: boolean): void => {
    if (routePreviewPlaying && enabled) {
      stopRoutePreviewInternal({
        statusMessage: "Route preview canceled by camera navigation."
      });
      return;
    }

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
    if (objectId === null) {
      clearSelection();
      return;
    }

    replaceSelection([objectId], objectId);
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
    setGizmoAttachmentForSelection();
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

  scene.onBeforeRenderObservable.add(() => {
    if (!gizmoInteractionState) {
      return;
    }

    if (gizmoInteractionState.interactionKind === "group-move") {
      applyGroupMoveDuringInteraction(gizmoInteractionState);
      return;
    }

    if (gizmoInteractionState.interactionKind === "group-rotate") {
      applyGroupRotateDuringInteraction(gizmoInteractionState);
      return;
    }

    if (gizmoInteractionState.interactionKind === "group-scale") {
      applyGroupScaleDuringInteraction(gizmoInteractionState);
    }
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
    if (routePreviewPlaying) {
      stopRoutePreviewInternal({ notifyAfter: false });
    }

    for (const entry of placedObjects.values()) {
      // Instances can share material/texture resources from their source container.
      // Avoid disposing shared materials during object delete/undo/redo restores.
      entry.root.dispose(false);
    }

    placedObjects.clear();
    nodeObjectMap.clear();
    if (multiSelectionTransformPivotNode) {
      multiSelectionTransformPivotNode.dispose(false, true);
      multiSelectionTransformPivotNode = null;
    }
    state.layoutRecords = [];
    state.selectedObjectIds = [];
    state.primarySelectedObjectId = null;
    state.selectedObjectId = null;
    selectionController.setSelection([]);
    gizmoManager.attachToNode(null);
    cancelGizmoInteraction();
    suppressNextPick = false;
  };

  const restoreHistorySnapshot = async (
    snapshot: BuilderHistorySnapshot,
    options?: { statusMessage?: string }
  ): Promise<boolean> => {
    clearAllObjects();
    state.layoutMetadata = cloneBuilderWorldMetadata(snapshot.layoutMetadata);
    reconcileRouteSelection();

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
    const rawSelectionIds = snapshot.selectedObjectIds.length > 0
      ? snapshot.selectedObjectIds
      : (snapshot.selectedObjectId ? [snapshot.selectedObjectId] : []);
    const snapshotSelectionIds = normalizeSelectionIds(rawSelectionIds);
    const fallbackSelectionIds = snapshotSelectionIds.length > 0
      ? snapshotSelectionIds
      : (firstObjectId ? [firstObjectId] : []);
    const fallbackPrimarySelectionId = resolvePrimarySelectionId(
      fallbackSelectionIds,
      snapshot.primarySelectedObjectId
    );
    const statusSuffix = skippedCount > 0
      ? ` ${skippedCount} object${skippedCount === 1 ? "" : "s"} could not be restored.`
      : "";
    state.statusMessage = `${options?.statusMessage ?? "History restored."}${statusSuffix}`;
    updateRouteOverlay();
    applySelectionState(fallbackSelectionIds, fallbackPrimarySelectionId);
    return true;
  };

  const clearUploads = async (): Promise<{ success: boolean; removedCount: number; error?: string }> => {
    state.statusMessage = "Clearing uploads...";
    notify();

    try {
      const removedIds = await clearUploadedAssets();
      clearAllObjects();
      state.layoutMetadata = undefined;
      reconcileRouteSelection();
      updateRouteOverlay();
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

  const normalizeScreenRect = (rect: BuilderScreenRect): BuilderScreenRect => ({
    left: Math.min(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    right: Math.max(rect.left, rect.right),
    bottom: Math.max(rect.top, rect.bottom)
  });

  const intersectsScreenRect = (
    left: number,
    top: number,
    right: number,
    bottom: number,
    rect: BuilderScreenRect
  ): boolean => (
    right >= rect.left &&
    left <= rect.right &&
    bottom >= rect.top &&
    top <= rect.bottom
  );

  const toRenderCoordinates = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvasRect = canvas.getBoundingClientRect();
    if (
      clientX < canvasRect.left ||
      clientX > canvasRect.right ||
      clientY < canvasRect.top ||
      clientY > canvasRect.bottom
    ) {
      return null;
    }

    const width = canvasRect.width;
    const height = canvasRect.height;
    if (width <= 0 || height <= 0) {
      return null;
    }

    const normalizedX = (clientX - canvasRect.left) / width;
    const normalizedY = (clientY - canvasRect.top) / height;

    return {
      x: normalizedX * engine.getRenderWidth(),
      y: normalizedY * engine.getRenderHeight()
    };
  };

  const resolveObjectIdAtClientPoint = (clientX: number, clientY: number): string | null => {
    const renderPoint = toRenderCoordinates(clientX, clientY);
    if (!renderPoint) {
      return null;
    }

    const pickInfo = scene.pick(renderPoint.x, renderPoint.y);
    if (!pickInfo?.hit) {
      return null;
    }

    return resolveObjectIdForMesh(pickInfo.pickedMesh ?? null);
  };

  const getMarqueeStartBlockReason = (clientX: number, clientY: number): string | null => {
    if (historyRestoreInFlight) {
      return "history-restore-in-flight";
    }

    if (routeModeEnabled) {
      return "route-mode-enabled";
    }

    if (gizmoManager.isDragging) {
      return "gizmo-dragging";
    }

    if (gizmoManager.isHovered) {
      return "gizmo-hovered";
    }

    const renderPoint = toRenderCoordinates(clientX, clientY);
    if (!renderPoint) {
      return "outside-canvas-or-invalid-canvas-size";
    }

    const resolvedObjectId = resolveObjectIdAtClientPoint(clientX, clientY);
    if (resolvedObjectId !== null) {
      return "object-hit";
    }

    return null;
  };

  const canStartMarqueeSelectionAt = (clientX: number, clientY: number): boolean => {
    const blockReason = getMarqueeStartBlockReason(clientX, clientY);
    const canStart = blockReason === null;

    if (isBrowserDebugEnabled()) {
      logBrowserDebug("builder:marquee:start-check", {
        canStart,
        blockReason: blockReason ?? "none",
        clientX,
        clientY,
        gizmoDragging: gizmoManager.isDragging,
        gizmoHovered: gizmoManager.isHovered,
        routeModeEnabled,
        historyRestoreInFlight,
        cameraNavigationEnabled: developmentCamera.isNavigationEnabled()
      });
    }

    return canStart;
  };

  const getEntryWorldBounds = (entry: PlacedObjectEntry): { minimum: Vector3; maximum: Vector3 } | null => {
    let minimum: Vector3 | null = null;
    let maximum: Vector3 | null = null;

    for (const mesh of entry.meshes) {
      if (mesh.isDisposed()) {
        continue;
      }

      const boundingBox = mesh.getBoundingInfo().boundingBox;
      const meshMinimum = boundingBox.minimumWorld;
      const meshMaximum = boundingBox.maximumWorld;

      minimum = minimum
        ? new Vector3(
            Math.min(minimum.x, meshMinimum.x),
            Math.min(minimum.y, meshMinimum.y),
            Math.min(minimum.z, meshMinimum.z)
          )
        : meshMinimum.clone();
      maximum = maximum
        ? new Vector3(
            Math.max(maximum.x, meshMaximum.x),
            Math.max(maximum.y, meshMaximum.y),
            Math.max(maximum.z, meshMaximum.z)
          )
        : meshMaximum.clone();
    }

    if (!minimum || !maximum) {
      return null;
    }

    return { minimum, maximum };
  };

  const getScreenBoundsForEntry = (
    entry: PlacedObjectEntry,
    canvasRect: DOMRect,
    renderWidth: number,
    renderHeight: number
  ): { left: number; top: number; right: number; bottom: number } | null => {
    const activeCamera = scene.activeCamera;
    if (!activeCamera) {
      return null;
    }

    const bounds = getEntryWorldBounds(entry);
    if (!bounds) {
      return null;
    }

    const { minimum, maximum } = bounds;
    const corners = [
      new Vector3(minimum.x, minimum.y, minimum.z),
      new Vector3(minimum.x, minimum.y, maximum.z),
      new Vector3(minimum.x, maximum.y, minimum.z),
      new Vector3(minimum.x, maximum.y, maximum.z),
      new Vector3(maximum.x, minimum.y, minimum.z),
      new Vector3(maximum.x, minimum.y, maximum.z),
      new Vector3(maximum.x, maximum.y, minimum.z),
      new Vector3(maximum.x, maximum.y, maximum.z)
    ];

    const viewport = activeCamera.viewport.toGlobal(renderWidth, renderHeight);
    const scaleX = canvasRect.width / renderWidth;
    const scaleY = canvasRect.height / renderHeight;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let hasProjectedPoint = false;

    for (const corner of corners) {
      const projected = Vector3.Project(corner, Matrix.Identity(), scene.getTransformMatrix(), viewport);
      const clientX = canvasRect.left + projected.x * scaleX;
      const clientY = canvasRect.top + projected.y * scaleY;

      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        continue;
      }

      minX = Math.min(minX, clientX);
      minY = Math.min(minY, clientY);
      maxX = Math.max(maxX, clientX);
      maxY = Math.max(maxY, clientY);
      hasProjectedPoint = true;
    }

    if (!hasProjectedPoint) {
      return null;
    }

    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY
    };
  };

  const applyMarqueeSelection = (rect: BuilderScreenRect, mode: BuilderSelectionMergeMode): void => {
    if (historyRestoreInFlight || routeModeEnabled) {
      if (isBrowserDebugEnabled()) {
        logBrowserDebug("builder:marquee:apply-skipped", {
          reason: historyRestoreInFlight ? "history-restore-in-flight" : "route-mode-enabled",
          mode
        });
      }
      return;
    }

    const normalizedRect = normalizeScreenRect(rect);
    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      if (isBrowserDebugEnabled()) {
        logBrowserDebug("builder:marquee:apply-skipped", {
          reason: "invalid-canvas-rect",
          mode,
          width: canvasRect.width,
          height: canvasRect.height
        });
      }
      return;
    }

    const renderWidth = engine.getRenderWidth();
    const renderHeight = engine.getRenderHeight();
    const candidateIds: string[] = [];

    for (const record of state.layoutRecords) {
      const entry = placedObjects.get(record.id);
      if (!entry) {
        continue;
      }

      const screenBounds = getScreenBoundsForEntry(entry, canvasRect, renderWidth, renderHeight);
      if (!screenBounds) {
        continue;
      }

      if (
        intersectsScreenRect(
          screenBounds.left,
          screenBounds.top,
          screenBounds.right,
          screenBounds.bottom,
          normalizedRect
        )
      ) {
        candidateIds.push(record.id);
      }
    }

    if (isBrowserDebugEnabled()) {
      logBrowserDebug("builder:marquee:apply", {
        mode,
        selectionBefore: [...state.selectedObjectIds],
        candidateIds,
        rect: normalizedRect
      });
    }

    if (mode === "replace") {
      replaceSelection(candidateIds, candidateIds[candidateIds.length - 1] ?? null);
      suppressNextPick = true;
      return;
    }

    if (mode === "add") {
      const nextSelectionIds = [...state.selectedObjectIds];
      for (const id of candidateIds) {
        if (!nextSelectionIds.includes(id)) {
          nextSelectionIds.push(id);
        }
      }

      applySelectionState(nextSelectionIds, state.primarySelectedObjectId);
      suppressNextPick = true;
      return;
    }

    const toggledSelectionIds = [...state.selectedObjectIds];
    for (const id of candidateIds) {
      const existingIndex = toggledSelectionIds.indexOf(id);
      if (existingIndex >= 0) {
        toggledSelectionIds.splice(existingIndex, 1);
      } else {
        toggledSelectionIds.push(id);
      }
    }

    applySelectionState(toggledSelectionIds, state.primarySelectedObjectId);
    suppressNextPick = true;
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
    const selectedObjectId = getPrimarySelectedObjectId();
    if (!selectedObjectId) {
      return;
    }

    const selectedObjectIds = normalizeSelectionIds(state.selectedObjectIds);
    if (selectedObjectIds.length <= 1) {
      const beforeSnapshot = captureHistorySnapshot();
      const didChange = updateObjectTransform(selectedObjectId, patch);
      if (!didChange) {
        return;
      }

      pushUndoSnapshot(beforeSnapshot);
      return;
    }

    const primaryEntry = placedObjects.get(selectedObjectId);
    if (!primaryEntry) {
      return;
    }

    const positionDelta: Partial<BuilderVector3> = {};
    if (typeof patch.position?.x === "number" && Number.isFinite(patch.position.x)) {
      positionDelta.x = patch.position.x - primaryEntry.layout.position.x;
    }
    if (typeof patch.position?.y === "number" && Number.isFinite(patch.position.y)) {
      positionDelta.y = patch.position.y - primaryEntry.layout.position.y;
    }
    if (typeof patch.position?.z === "number" && Number.isFinite(patch.position.z)) {
      positionDelta.z = patch.position.z - primaryEntry.layout.position.z;
    }

    const rotationDelta = typeof patch.rotationY === "number" && Number.isFinite(patch.rotationY)
      ? patch.rotationY - primaryEntry.layout.rotationY
      : undefined;

    const scaleDelta = typeof patch.scale === "number" && Number.isFinite(patch.scale)
      ? patch.scale - primaryEntry.layout.scale
      : undefined;

    const hasAnyDelta =
      positionDelta.x !== undefined ||
      positionDelta.y !== undefined ||
      positionDelta.z !== undefined ||
      rotationDelta !== undefined ||
      scaleDelta !== undefined;
    if (!hasAnyDelta) {
      return;
    }

    const beforeSnapshot = captureHistorySnapshot();
    let didChange = false;

    for (const objectId of selectedObjectIds) {
      const entry = placedObjects.get(objectId);
      if (!entry) {
        continue;
      }

      const nextPatch: {
        position?: Partial<BuilderVector3>;
        rotationY?: number;
        scale?: number;
      } = {};

      if (positionDelta.x !== undefined || positionDelta.y !== undefined || positionDelta.z !== undefined) {
        const nextPositionPatch: Partial<BuilderVector3> = {};
        if (positionDelta.x !== undefined) {
          nextPositionPatch.x = entry.layout.position.x + positionDelta.x;
        }
        if (positionDelta.y !== undefined) {
          nextPositionPatch.y = entry.layout.position.y + positionDelta.y;
        }
        if (positionDelta.z !== undefined) {
          nextPositionPatch.z = entry.layout.position.z + positionDelta.z;
        }
        nextPatch.position = nextPositionPatch;
      }

      if (rotationDelta !== undefined) {
        nextPatch.rotationY = entry.layout.rotationY + rotationDelta;
      }

      if (scaleDelta !== undefined) {
        nextPatch.scale = Math.max(0.1, entry.layout.scale + scaleDelta);
      }

      const didUpdate = updateObjectTransform(objectId, nextPatch, { silentStatus: true });
      didChange = didUpdate || didChange;
    }

    if (!didChange) {
      return;
    }

    pushUndoSnapshot(beforeSnapshot);
    state.statusMessage = `Updated ${selectedObjectIds.length} selected objects.`;
    notify();
  };

  const toRouteVector = (value: Vector3): [number, number, number] => [
    Number(value.x.toFixed(3)),
    Number(value.y.toFixed(3)),
    Number(value.z.toFixed(3))
  ];

  const sanitizeRouteName = (name: string | undefined, fallback: string): string => {
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
  };

  const createUniqueRouteName = (metadata: BuilderWorldCameraRoutesMetadata): string => {
    let routeNumber = metadata.routes.length + 1;
    while (metadata.routes.some((route) => route.name === `Route ${routeNumber}`)) {
      routeNumber += 1;
    }
    return `Route ${routeNumber}`;
  };

  const createUniqueRouteId = (metadata: BuilderWorldCameraRoutesMetadata, preferredBase: string): string => {
    const sanitizedBase = preferredBase
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "route";
    let candidate = sanitizedBase;
    let suffix = 2;
    while (metadata.routes.some((route) => route.id === candidate)) {
      candidate = `${sanitizedBase}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  };

  const setRouteModeEnabled = (enabled: boolean): void => {
    if (routeModeEnabled === enabled) {
      return;
    }

    routeModeEnabled = enabled;
    if (!enabled) {
      stopRoutePreviewInternal({
        statusMessage: "Route mode disabled.",
        notifyAfter: false
      });
      selectedRoutePointIndex = null;
    } else {
      reconcileRouteSelection();
      state.statusMessage = "Route mode enabled. Use camera navigation mode to compose viewpoints, then capture points.";
    }
    updateRouteOverlay();
    notify();
  };

  const getRouteEditState = (): BuilderRouteEditState => cloneRouteEditState();

  const selectRoute = (routeId: string | null): void => {
    const metadata = getCameraRoutesMetadata();
    if (!metadata || metadata.routes.length === 0) {
      selectedRouteId = null;
      selectedRoutePointIndex = null;
      updateRouteOverlay();
      notify();
      return;
    }

    if (routeId === null) {
      selectedRouteId = metadata.routes[0]?.id ?? null;
    } else if (metadata.routes.some((route) => route.id === routeId)) {
      selectedRouteId = routeId;
    } else {
      return;
    }

    selectedRoutePointIndex = null;
    normalizeSelectedPointIndex();
    updateRouteOverlay();
    notify();
  };

  const createRoute = (name?: string): string | null => {
    let createdRouteId: string | null = null;
    const didCreateRoute = applyRouteMetadataChange(
      (metadata) => {
        const nextName = sanitizeRouteName(name, createUniqueRouteName(metadata));
        const nextId = createUniqueRouteId(metadata, nextName);
        const nextRoute: CameraRouteDefinition = {
          id: nextId,
          name: nextName,
          loop: false,
          timing: {
            mode: "duration",
            totalDurationMs: ROUTE_DEFAULT_DURATION_MS
          },
          easing: "easeInOutSine",
          points: []
        };
        metadata.routes.push(nextRoute);
        if (!metadata.defaultRouteId) {
          metadata.defaultRouteId = nextId;
        }
        selectedRouteId = nextId;
        selectedRoutePointIndex = null;
        createdRouteId = nextId;
        return true;
      },
      "Created camera route."
    );

    return didCreateRoute ? createdRouteId : null;
  };

  const deleteRoute = (routeId: string): boolean => applyRouteMetadataChange(
    (metadata) => {
      const routeIndex = metadata.routes.findIndex((route) => route.id === routeId);
      if (routeIndex < 0) {
        return false;
      }

      metadata.routes.splice(routeIndex, 1);
      if (metadata.defaultRouteId === routeId) {
        metadata.defaultRouteId = metadata.routes[0]?.id;
      }

      if (selectedRouteId === routeId) {
        selectedRouteId = metadata.routes[routeIndex]?.id ?? metadata.routes[Math.max(0, routeIndex - 1)]?.id ?? null;
        selectedRoutePointIndex = null;
      }

      if (metadata.routes.length === 0) {
        const layoutMetadata = ensureLayoutMetadata();
        delete layoutMetadata.cameraRoutes;
        cleanupEmptyMetadata();
      }

      return true;
    },
    "Deleted camera route."
  );

  const setDefaultRoute = (routeId: string | null): void => {
    applyRouteMetadataChange(
      (metadata) => {
        if (routeId === null) {
          if (!metadata.defaultRouteId) {
            return false;
          }

          delete metadata.defaultRouteId;
          return true;
        }

        if (!metadata.routes.some((route) => route.id === routeId)) {
          return false;
        }

        if (metadata.defaultRouteId === routeId) {
          return false;
        }

        metadata.defaultRouteId = routeId;
        return true;
      },
      routeId ? "Updated default camera route." : "Cleared default camera route."
    );
  };

  const selectRoutePoint = (pointIndex: number | null): void => {
    const route = getSelectedRouteMetadata();
    if (!route) {
      selectedRoutePointIndex = null;
      updateRouteOverlay();
      notify();
      return;
    }

    if (pointIndex === null) {
      selectedRoutePointIndex = null;
    } else if (pointIndex >= 0 && pointIndex < route.points.length) {
      selectedRoutePointIndex = pointIndex;
    } else {
      return;
    }

    updateRouteOverlay();
    notify();
  };

  const addPointFromCurrentCamera = (dwellMs = 0): boolean => applyRouteMetadataChange(
    () => {
      const route = getSelectedRouteMetadata();
      if (!route) {
        return false;
      }

      const cameraPosition = developmentCamera.camera.position;
      const cameraTarget = developmentCamera.camera.getTarget();
      const nextPoint: CameraRoutePoint = {
        position: toRouteVector(cameraPosition),
        lookAt: toRouteVector(cameraTarget),
        dwellMs: Math.max(0, Number.isFinite(dwellMs) ? dwellMs : 0)
      };
      route.points.push(nextPoint);
      selectedRoutePointIndex = route.points.length - 1;
      return true;
    },
    "Captured camera route point."
  );

  const removePoint = (pointIndex: number): boolean => applyRouteMetadataChange(
    () => {
      const route = getSelectedRouteMetadata();
      if (!route || pointIndex < 0 || pointIndex >= route.points.length) {
        return false;
      }

      route.points.splice(pointIndex, 1);
      if (route.points.length === 0) {
        selectedRoutePointIndex = null;
      } else if (selectedRoutePointIndex === null) {
        selectedRoutePointIndex = Math.min(pointIndex, route.points.length - 1);
      } else if (selectedRoutePointIndex > pointIndex) {
        selectedRoutePointIndex -= 1;
      } else if (selectedRoutePointIndex >= route.points.length) {
        selectedRoutePointIndex = route.points.length - 1;
      }

      return true;
    },
    "Removed camera route point."
  );

  const movePoint = (pointIndex: number, direction: BuilderRoutePointMoveDirection): boolean => applyRouteMetadataChange(
    () => {
      const route = getSelectedRouteMetadata();
      if (!route) {
        return false;
      }

      const swapIndex = direction === "up" ? pointIndex - 1 : pointIndex + 1;
      if (pointIndex < 0 || swapIndex < 0 || pointIndex >= route.points.length || swapIndex >= route.points.length) {
        return false;
      }

      const [point] = route.points.splice(pointIndex, 1);
      if (!point) {
        return false;
      }

      route.points.splice(swapIndex, 0, point);
      if (selectedRoutePointIndex === pointIndex) {
        selectedRoutePointIndex = swapIndex;
      } else if (selectedRoutePointIndex === swapIndex) {
        selectedRoutePointIndex = pointIndex;
      }
      return true;
    },
    "Reordered camera route point."
  );

  const updateRouteSettings = (patch: BuilderRouteSettingsPatch): boolean => applyRouteMetadataChange(
    () => {
      const route = getSelectedRouteMetadata();
      if (!route) {
        return false;
      }

      let didChange = false;
      if (typeof patch.name === "string") {
        const nextName = patch.name.trim();
        if (nextName && nextName !== route.name) {
          route.name = nextName;
          didChange = true;
        }
      }

      if (typeof patch.loop === "boolean" && patch.loop !== route.loop) {
        route.loop = patch.loop;
        didChange = true;
      }

      if (patch.easing && patch.easing !== route.easing) {
        route.easing = patch.easing;
        didChange = true;
      }

      if (patch.timing) {
        if (patch.timing.mode === "duration") {
          const duration = Math.max(0, patch.timing.totalDurationMs);
          if (
            route.timing.mode !== "duration" ||
            route.timing.totalDurationMs !== duration
          ) {
            route.timing = {
              mode: "duration",
              totalDurationMs: duration
            };
            didChange = true;
          }
        } else {
          const speed = Math.max(0.001, patch.timing.unitsPerSecond);
          if (
            route.timing.mode !== "speed" ||
            route.timing.unitsPerSecond !== speed
          ) {
            route.timing = {
              mode: "speed",
              unitsPerSecond: speed
            };
            didChange = true;
          }
        }
      }

      return didChange;
    },
    "Updated camera route settings."
  );

  const previewSelectedRoute = (): boolean => {
    const route = getSelectedRouteMetadata();
    if (!route) {
      state.statusMessage = "Create or select a camera route first.";
      notify();
      return false;
    }

    if (route.points.length < 2) {
      state.statusMessage = "Add at least two camera points before previewing.";
      notify();
      return false;
    }

    stopRoutePreviewInternal({ notifyAfter: false });
    routePlayer.setRoute(route);
    routePreviewCameraNavigationBefore = developmentCamera.isNavigationEnabled();
    developmentCamera.setNavigationEnabled(false);
    routePlayer.play({ restart: true });
    routePreviewPlaying = routePlayer.isPlaying();
    state.statusMessage = routePreviewPlaying
      ? `Previewing route "${route.name}".`
      : `Could not preview route "${route.name}".`;
    notify();
    return routePreviewPlaying;
  };

  const stopRoutePreview = (options?: { resetToStart?: boolean }): void => {
    stopRoutePreviewInternal({
      resetToStart: options?.resetToStart,
      statusMessage: "Route preview stopped."
    });
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
    const wasSelected = state.selectedObjectIds.includes(objectId);
    const wasPrimarySelected = state.primarySelectedObjectId === objectId;
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
      const remainingSelectedObjectIds = state.selectedObjectIds.filter((id) => id !== objectId);
      const fallbackSelectionId =
        state.layoutRecords[removedIndex]?.id ?? state.layoutRecords[Math.max(0, removedIndex - 1)]?.id ?? null;
      const nextSelectionIds = remainingSelectedObjectIds.length > 0
        ? remainingSelectedObjectIds
        : (fallbackSelectionId ? [fallbackSelectionId] : []);
      const nextPrimarySelectionId = wasPrimarySelected
        ? nextSelectionIds[nextSelectionIds.length - 1] ?? null
        : state.primarySelectedObjectId;
      applySelectionState(nextSelectionIds, nextPrimarySelectionId);
      return true;
    }

    notify();
    return true;
  };

  const deleteObjectById = (objectId: string): void => {
    deleteObjectByIdInternal(objectId);
  };

  const deleteSelectedObject = (): void => {
    const selectedObjectIds = normalizeSelectionIds(state.selectedObjectIds);
    if (selectedObjectIds.length === 0) {
      return;
    }

    if (selectedObjectIds.length === 1) {
      deleteObjectByIdInternal(selectedObjectIds[0]);
      return;
    }

    if (historyRestoreInFlight) {
      return;
    }

    const beforeSnapshot = captureHistorySnapshot();
    const selectedIdSet = new Set(selectedObjectIds);
    if (gizmoInteractionState && selectedIdSet.has(gizmoInteractionState.objectId)) {
      cancelGizmoInteraction();
    }

    let removedCount = 0;
    for (const objectId of selectedObjectIds) {
      const entry = placedObjects.get(objectId);
      if (!entry) {
        continue;
      }

      disposeEntry(entry);
      removedCount += 1;
    }

    if (removedCount === 0) {
      return;
    }

    state.layoutRecords = state.layoutRecords.filter((record) => !selectedIdSet.has(record.id));
    applySelectionState([], null, { notify: false });
    pushUndoSnapshot(beforeSnapshot);
    state.statusMessage = `Deleted ${removedCount} selected object${removedCount === 1 ? "" : "s"}.`;
    notify();

    return;
  };

  const duplicateSelectedObject = async (): Promise<void> => {
    if (historyRestoreInFlight) {
      return;
    }

    const selectedObjectIds = normalizeSelectionIds(state.selectedObjectIds);
    const primarySelectedObjectId = getPrimarySelectedObjectId();
    if (selectedObjectIds.length === 0 || !primarySelectedObjectId) {
      return;
    }

    const beforeSnapshot = captureHistorySnapshot();
    const duplicatedObjectIds: string[] = [];
    const duplicatedIdBySourceId = new Map<string, string>();

    for (const sourceObjectId of selectedObjectIds) {
      const source = placedObjects.get(sourceObjectId);
      if (!source) {
        continue;
      }

      const duplicateRecord: BuilderLayoutRecord = {
        ...cloneLayoutRecord(source.layout),
        id: createObjectId()
      };

      const didInstantiate = await instantiateRecord(duplicateRecord);
      if (!didInstantiate) {
        continue;
      }

      duplicatedObjectIds.push(duplicateRecord.id);
      duplicatedIdBySourceId.set(sourceObjectId, duplicateRecord.id);
    }

    if (duplicatedObjectIds.length === 0) {
      return;
    }

    const nextPrimaryDuplicatedId = duplicatedIdBySourceId.get(primarySelectedObjectId)
      ?? duplicatedObjectIds[duplicatedObjectIds.length - 1]
      ?? null;

    state.statusMessage = duplicatedObjectIds.length === 1
      ? "Duplicated selected object."
      : `Duplicated ${duplicatedObjectIds.length} selected objects.`;
    pushUndoSnapshot(beforeSnapshot);
    replaceSelection(duplicatedObjectIds, nextPrimaryDuplicatedId);
  };

  const exportLayout = (): string => serializeBuilderLayout(
    state.layoutRecords.map(cloneLayoutRecord),
    state.layoutMetadata
  );

  const exportWorldPackage = async (
    worldName: string
  ): Promise<{
    fileName: string;
    blob: Blob;
    objectCount: number;
    uploadedAssetCount: number;
  }> => {
    const layoutRecords = state.layoutRecords.map(cloneLayoutRecord);
    const referencedAssetIds = Array.from(new Set(layoutRecords.map((record) => record.assetId)));
    const uploadedSnapshots = await listUploadedAssetSnapshots();
    const uploadedSnapshotsById = new Map(uploadedSnapshots.map((snapshot) => [snapshot.id, snapshot]));
    const builtInAssets: Array<{ id: string; label: string }> = [];
    const uploadedAssets: Array<{
      blob: Blob;
      category: string;
      fileName: string;
      id: string;
      label: string;
      mimeType: string;
      rotationY: number;
      scale: number;
      uploadedAt: string;
    }> = [];

    for (const assetId of referencedAssetIds) {
      const definition = assetDefinitions.get(assetId);
      if (!definition) {
        throw new Error(`Cannot export world package because asset is unavailable: ${assetId}.`);
      }

      if (definition.source.type === "uploaded") {
        const snapshot = uploadedSnapshotsById.get(assetId);
        if (!snapshot) {
          throw new Error(`Cannot export world package because uploaded asset is missing locally: ${assetId}.`);
        }

        uploadedAssets.push({
          blob: snapshot.blob,
          category: snapshot.category,
          fileName: snapshot.fileName,
          id: snapshot.id,
          label: snapshot.label,
          mimeType: snapshot.mimeType,
          rotationY: snapshot.rotationY,
          scale: snapshot.scale,
          uploadedAt: snapshot.createdAt
        });
        continue;
      }

      builtInAssets.push({
        id: definition.id,
        label: definition.label
      });
    }

    return createWorldPackageFile({
      builtInAssets,
      exportedFromAppVersion: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
      layoutMetadata: state.layoutMetadata,
      layoutRecords,
      uploadedAssets,
      worldName
    });
  };

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
    state.layoutMetadata = cloneBuilderWorldMetadata(result.value.metadata);
    reconcileRouteSelection();

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
    updateRouteOverlay();
    setSelection(firstImportedObjectId);

    return {
      success: true
    };
  };

  const importWorldPackage = async (
    file: File
  ): Promise<{ success: boolean; uploadedAssetCount?: number; remappedAssetCount?: number; error?: string }> => {
    if (historyRestoreInFlight) {
      return {
        success: false,
        error: "History restore is in progress."
      };
    }

    state.statusMessage = `Importing world package ${file.name}...`;
    notify();

    try {
      const packageImport = await importWorldPackageFile(file);
      await refreshAssetCatalog({ notify: false });
      const importedLayout = await importLayout(packageImport.layoutJson);
      if (!importedLayout.success) {
        return importedLayout;
      }

      const remapSuffix = packageImport.remappedAssetCount
        ? ` Remapped ${packageImport.remappedAssetCount} conflicting uploaded asset id${packageImport.remappedAssetCount === 1 ? "" : "s"}.`
        : "";
      state.statusMessage = `Imported world package "${packageImport.worldName}". Restored ${
        packageImport.uploadedAssetCount
      } uploaded asset${packageImport.uploadedAssetCount === 1 ? "" : "s"} (${packageImport.importedUploadedAssetCount} new, ${
        packageImport.reusedUploadedAssetCount
      } reused).${remapSuffix}`;
      notify();
      return {
        success: true,
        uploadedAssetCount: packageImport.uploadedAssetCount,
        remappedAssetCount: packageImport.remappedAssetCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "World package could not be imported.";
      state.statusMessage = message;
      notify();
      return {
        success: false,
        error: message
      };
    }
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
    const validIds = new Set(nextLayoutRecords.map((record) => record.id));
    const rawSelectionIds = snapshot.selectedObjectIds.length > 0
      ? snapshot.selectedObjectIds
      : (snapshot.selectedObjectId ? [snapshot.selectedObjectId] : []);
    const selectedObjectIds = rawSelectionIds.filter((id) => validIds.has(id));
    const primarySelectedObjectId = resolvePrimarySelectionId(selectedObjectIds, snapshot.primarySelectedObjectId);
    return {
      ...snapshot,
      layoutRecords: nextLayoutRecords,
      selectedObjectIds,
      primarySelectedObjectId
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
    const selectedObjectId = resolveObjectIdForMesh(pickedMesh);
    const isAdditiveClick = Boolean(pointerEvent?.shiftKey);
    const isToggleClick = Boolean(pointerEvent?.ctrlKey || pointerEvent?.metaKey);

    if (!selectedObjectId) {
      if (!isAdditiveClick && !isToggleClick) {
        clearSelection();
      }
      return;
    }

    if (isToggleClick) {
      toggleSelection(selectedObjectId);
      return;
    }

    if (isAdditiveClick) {
      addToSelection(selectedObjectId);
      return;
    }

    replaceSelection([selectedObjectId], selectedObjectId);
  });

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "escape") {
      clearSelection();
      return;
    }

    if (key !== "r") {
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
      selectedObjectIds: string[];
      primarySelectedObjectId: string | null;
      selectedObjectId: string | null;
      transformMode: BuilderTransformMode;
    };
  };

  let debugApi: BuilderDebugApi | null = null;
  if (isBrowserDebugEnabled() && typeof window !== "undefined") {
    debugApi = {
      applySelectedRootDeltaForTest: (delta) => {
        const selectedObjectId = getPrimarySelectedObjectId();
        if (!selectedObjectId) {
          return false;
        }

        const entry = placedObjects.get(selectedObjectId);
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
        const primarySelectedObjectId = getPrimarySelectedObjectId();
        const selectedEntry = primarySelectedObjectId ? placedObjects.get(primarySelectedObjectId) : null;
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
          selectedObjectIds: [...state.selectedObjectIds],
          primarySelectedObjectId,
          selectedObjectId: deriveCompatibilitySelectedObjectId(),
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
    stopRoutePreviewInternal({ notifyAfter: false });
    routePlayer.dispose();
    disposeRouteOverlay();
    routeOverlayMaterials?.defaultPoint.dispose(false, true);
    routeOverlayMaterials?.selectedPoint.dispose(false, true);
    routeOverlayMaterials = null;
    if (multiSelectionTransformPivotNode) {
      multiSelectionTransformPivotNode.dispose(false, true);
      multiSelectionTransformPivotNode = null;
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
    setRouteModeEnabled,
    getRouteEditState,
    createRoute,
    selectRoute,
    deleteRoute,
    setDefaultRoute,
    addPointFromCurrentCamera,
    selectRoutePoint,
    removePoint,
    movePoint,
    updateRouteSettings,
    previewSelectedRoute,
    stopRoutePreview,
    deleteSelectedObject,
    deleteObjectById,
    duplicateSelectedObject,
    exportLayout,
    exportWorldPackage,
    getSnapshot,
    importWorldPackage,
    importLayout,
    isCameraNavigationEnabled: () => developmentCamera.isNavigationEnabled(),
    getTransformMode: () => transformMode,
    placeAsset,
    canStartMarqueeSelectionAt,
    applyMarqueeSelection,
    replaceSelection,
    addToSelection,
    toggleSelection,
    removeFromSelection,
    clearSelection,
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
