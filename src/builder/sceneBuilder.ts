import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
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
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";
import { natureKitAssetManifest, type NatureKitAssetKey } from "../generation/natureKitAssetManifest";
import { getBuilderPalette } from "./builderPalette";
import { parseBuilderLayoutDocument, serializeBuilderLayout } from "./sceneLayoutSerializer";
import { createBuilderSceneState } from "./sceneBuilderState";
import type {
  BuilderLayoutRecord,
  BuilderSceneSnapshot,
  BuilderSelectedObjectSnapshot,
  BuilderVector3
} from "./builderTypes";
import { createSelectionController } from "./selectionController";

interface CreateSceneBuilderOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
}

export interface SceneBuilderController {
  scene: Scene;
  deleteSelectedObject: () => void;
  deleteObjectById: (objectId: string) => void;
  duplicateSelectedObject: () => void;
  exportLayout: () => string;
  getSnapshot: () => BuilderSceneSnapshot;
  importLayout: (input: string) => { success: boolean; error?: string };
  placeAsset: (assetId: NatureKitAssetKey) => void;
  selectObjectById: (objectId: string | null) => void;
  subscribe: (listener: () => void) => () => void;
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

interface BuilderDragState {
  objectId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startGroundPoint: Vector3;
  startPosition: BuilderVector3;
  didDrag: boolean;
}

export async function createSceneBuilder({
  canvas,
  engine
}: CreateSceneBuilderOptions): Promise<SceneBuilderController> {
  const scene = new Scene(engine);
  const developmentCamera = createDevelopmentCamera(scene, canvas);
  const state = createBuilderSceneState();
  const palette = getBuilderPalette();
  const selectionController = createSelectionController(scene);
  const listeners = new Set<() => void>();
  const placedObjects = new Map<string, PlacedObjectEntry>();
  const nodeObjectMap = new Map<number, string>();
  let dragState: BuilderDragState | null = null;
  let suppressNextPick = false;
  let nextObjectNumber = 1;

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

  const assetLibrary = await loadNatureKitAssetLibrary(scene);

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const cloneLayoutRecord = (record: BuilderLayoutRecord): BuilderLayoutRecord => ({
    id: record.id,
    assetId: record.assetId,
    position: { ...record.position },
    rotationY: record.rotationY,
    scale: record.scale
  });

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
      assetLabel: natureKitAssetManifest[entry.layout.assetId].label
    };
  };

  const getSnapshot = (): BuilderSceneSnapshot => ({
    isReady: state.isReady,
    palette,
    objects: state.layoutRecords.map(cloneLayoutRecord),
    selectedObjectId: state.selectedObjectId,
    selectedObject: getSelectedObjectSnapshot(),
    statusMessage: state.statusMessage
  });

  const applyLayoutToEntry = (entry: PlacedObjectEntry): void => {
    const definition = natureKitAssetManifest[entry.layout.assetId];
    entry.root.position.set(entry.layout.position.x, entry.layout.position.y, entry.layout.position.z);
    entry.root.rotation.set(0, definition.rotationY + entry.layout.rotationY, 0);

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
      notify();
      return;
    }

    const entry = placedObjects.get(objectId);
    selectionController.setSelection(entry?.meshes ?? []);
    notify();
  };

  const selectObjectById = (objectId: string | null): void => {
    if (objectId && !placedObjects.has(objectId)) {
      return;
    }

    setSelection(objectId);
  };

  const instantiateRecord = (record: BuilderLayoutRecord): void => {
    const root = assetLibrary.instantiateAsset(record.assetId, record.id, new Vector3(record.position.x, record.position.y, record.position.z));
    const meshes = root.getChildMeshes(false).filter((mesh): mesh is Mesh => mesh instanceof Mesh);
    const entry: PlacedObjectEntry = {
      layout: record,
      meshes,
      root
    };

    applyLayoutToEntry(entry);
    placedObjects.set(record.id, entry);
    state.layoutRecords.push(record);
    registerNodeMap(entry);
  };

  const disposeEntry = (entry: PlacedObjectEntry): void => {
    unregisterNodeMap(entry);
    entry.root.dispose(false, true);
    placedObjects.delete(entry.layout.id);
  };

  const clearAllObjects = (): void => {
    for (const entry of placedObjects.values()) {
      entry.root.dispose(false, true);
    }

    placedObjects.clear();
    nodeObjectMap.clear();
    state.layoutRecords = [];
    selectionController.setSelection([]);
    state.selectedObjectId = null;
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

    if (patch.position) {
      if (typeof patch.position.x === "number" && Number.isFinite(patch.position.x)) {
        entry.layout.position.x = patch.position.x;
      }

      if (typeof patch.position.y === "number" && Number.isFinite(patch.position.y)) {
        entry.layout.position.y = patch.position.y;
      }

      if (typeof patch.position.z === "number" && Number.isFinite(patch.position.z)) {
        entry.layout.position.z = patch.position.z;
      }
    }

    if (typeof patch.rotationY === "number" && Number.isFinite(patch.rotationY)) {
      entry.layout.rotationY = patch.rotationY;
    }

    if (typeof patch.scale === "number" && Number.isFinite(patch.scale) && patch.scale > 0) {
      entry.layout.scale = patch.scale;
    }

    applyLayoutToEntry(entry);

    if (!options?.silentStatus) {
      state.statusMessage = options?.statusMessage ?? `Updated ${natureKitAssetManifest[entry.layout.assetId].label}.`;
    }

    notify();
    return true;
  };

  const getGroundPoint = (): Vector3 | null => {
    const groundPick = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh === ground);
    if (!groundPick?.hit || !groundPick.pickedPoint) {
      return null;
    }

    return groundPick.pickedPoint.clone();
  };

  const placeAsset = (assetId: NatureKitAssetKey): void => {
    if (!state.isReady) {
      state.statusMessage = "Builder assets are still loading.";
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

    instantiateRecord(record);
    state.statusMessage = `Placed ${natureKitAssetManifest[assetId].label}.`;
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

    updateObjectTransform(state.selectedObjectId, patch);
  };

  const deleteObjectById = (objectId: string): void => {
    const entry = placedObjects.get(objectId);
    if (!entry) {
      return;
    }

    const label = natureKitAssetManifest[entry.layout.assetId].label;
    const wasSelected = state.selectedObjectId === objectId;

    if (dragState?.objectId === objectId) {
      dragState = null;
    }

    disposeEntry(entry);
    state.layoutRecords = state.layoutRecords.filter((record) => record.id !== objectId);
    state.statusMessage = `Deleted ${label}.`;

    if (wasSelected) {
      setSelection(null);
      return;
    }

    notify();
  };

  const deleteSelectedObject = (): void => {
    if (!state.selectedObjectId) {
      return;
    }

    deleteObjectById(state.selectedObjectId);
  };

  const duplicateSelectedObject = (): void => {
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

    instantiateRecord(duplicateRecord);
    state.statusMessage = `Duplicated ${natureKitAssetManifest[duplicateRecord.assetId].label}.`;
    setSelection(duplicateRecord.id);
  };

  const exportLayout = (): string => serializeBuilderLayout(state.layoutRecords.map(cloneLayoutRecord));

  const importLayout = (input: string): { success: boolean; error?: string } => {
    const result = parseBuilderLayoutDocument(input);

    if (!result.success) {
      state.statusMessage = result.error;
      notify();
      return {
        success: false,
        error: result.error
      };
    }

    clearAllObjects();

    for (const record of result.value.objects.map(cloneLayoutRecord)) {
      instantiateRecord(record);

      const suffix = Number(record.id.split("-").at(-1));
      if (Number.isFinite(suffix)) {
        nextObjectNumber = Math.max(nextObjectNumber, suffix + 1);
      }
    }

    state.statusMessage = `Imported ${result.value.objects.length} object${result.value.objects.length === 1 ? "" : "s"}.`;
    setSelection(result.value.objects[0]?.id ?? null);

    return {
      success: true
    };
  };

  scene.onPointerObservable.add((pointerInfo) => {
    const pointerEvent = pointerInfo.event as PointerEvent | undefined;

    if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
      if (!pointerEvent || pointerEvent.button !== 0) {
        return;
      }

      const objectId = resolveObjectIdForMesh(pointerInfo.pickInfo?.pickedMesh ?? null);
      if (!objectId) {
        return;
      }

      const groundPoint = getGroundPoint();
      const entry = placedObjects.get(objectId);
      if (!groundPoint || !entry) {
        return;
      }

      setSelection(objectId);
      dragState = {
        objectId,
        pointerId: pointerEvent.pointerId,
        startClientX: pointerEvent.clientX,
        startClientY: pointerEvent.clientY,
        startGroundPoint: groundPoint,
        startPosition: { ...entry.layout.position },
        didDrag: false
      };
      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
      if (!dragState || !pointerEvent || pointerEvent.pointerId !== dragState.pointerId) {
        return;
      }

      const currentGroundPoint = getGroundPoint();
      if (!currentGroundPoint) {
        return;
      }

      const movementDistance = Math.hypot(
        pointerEvent.clientX - dragState.startClientX,
        pointerEvent.clientY - dragState.startClientY
      );

      if (!dragState.didDrag && movementDistance < 4) {
        return;
      }

      dragState.didDrag = true;

      updateObjectTransform(
        dragState.objectId,
        {
          position: {
            x: Number((dragState.startPosition.x + currentGroundPoint.x - dragState.startGroundPoint.x).toFixed(3)),
            y: dragState.startPosition.y,
            z: Number((dragState.startPosition.z + currentGroundPoint.z - dragState.startGroundPoint.z).toFixed(3))
          }
        },
        { silentStatus: true }
      );
      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERUP) {
      if (!dragState || !pointerEvent || pointerEvent.pointerId !== dragState.pointerId) {
        return;
      }

      const completedDrag = dragState;
      dragState = null;

      if (!completedDrag.didDrag) {
        return;
      }

      const movedEntry = placedObjects.get(completedDrag.objectId);
      if (movedEntry) {
        state.statusMessage = `Moved ${natureKitAssetManifest[movedEntry.layout.assetId].label}.`;
        notify();
      }

      suppressNextPick = true;
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

    const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
    setSelection(resolveObjectIdForMesh(pickedMesh));
  });

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.key.toLowerCase() !== "r") {
      return;
    }

    if (state.isPanelOpen) {
      developmentCamera.resetOverview(true);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", handleKeyDown);
    clearAllObjects();
    assetLibrary.dispose();
    selectionController.dispose();
    developmentCamera.dispose();
  });

  state.isReady = true;
  state.statusMessage = "Builder ready. Choose an asset and place it into the scene.";

  return {
    scene,
    deleteSelectedObject,
    deleteObjectById,
    duplicateSelectedObject,
    exportLayout,
    getSnapshot,
    importLayout,
    placeAsset,
    selectObjectById,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateSelectedTransform
  };
}