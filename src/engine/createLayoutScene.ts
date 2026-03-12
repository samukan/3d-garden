import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";

import type { BuilderLayoutRecord } from "../builder/builderTypes";
import type { AssetDefinition } from "../generation/natureKitAssetManifest";
import { createDevelopmentCamera, type CameraOverviewFrame } from "./developmentCamera";
import { createAssetDefinitionMap, loadAssetDefinitions } from "../generation/assetCatalog";
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";
import { degreesToRadians } from "../utils/angle";
import { enableMeshVertexColors } from "../utils/meshColors";
import type { ViewerLoadIssue, ViewerWorldBounds } from "../viewer/viewerTypes";

interface CreateLayoutSceneOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
  layoutRecords: BuilderLayoutRecord[];
  onProgress?: (progress: {
    totalObjectCount: number;
    processedObjectCount: number;
    loadedObjectCount: number;
    skippedObjectCount: number;
  }) => void;
}

export interface LayoutSceneController {
  scene: Scene;
  loadedObjectCount: number;
  skippedObjectCount: number;
  skippedAssetIds: string[];
  loadIssues: ViewerLoadIssue[];
  worldBounds: ViewerWorldBounds | null;
  resetView: () => void;
}

function createWorldBounds(min: Vector3, max: Vector3): ViewerWorldBounds {
  const size = max.subtract(min);
  const center = min.add(max).scale(0.5);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;

  return {
    min: { x: min.x, y: min.y, z: min.z },
    max: { x: max.x, y: max.y, z: max.z },
    center: { x: center.x, y: center.y, z: center.z },
    size: { x: size.x, y: size.y, z: size.z },
    radius
  };
}

function toOverviewFrame(bounds: ViewerWorldBounds): CameraOverviewFrame {
  const horizontalSpan = Math.max(bounds.size.x, bounds.size.z);
  const radius = Math.max(10, Math.min(110, horizontalSpan * 1.2 + bounds.size.y * 0.8 + 8));
  return {
    alpha: -Math.PI / 2,
    beta: 1.02,
    radius,
    target: new Vector3(bounds.center.x, Math.max(0.5, bounds.center.y), bounds.center.z)
  };
}

export async function createLayoutScene({
  canvas,
  engine,
  layoutRecords,
  onProgress
}: CreateLayoutSceneOptions): Promise<LayoutSceneController> {
  const scene = new Scene(engine);
  const developmentCamera = createDevelopmentCamera(scene, canvas);
  scene.activeCamera = developmentCamera.camera;

  scene.clearColor = new Color4(0.79, 0.87, 0.92, 1);
  scene.ambientColor = new Color3(0.2, 0.24, 0.22);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0056;
  scene.fogColor = new Color3(0.86, 0.91, 0.9);

  const hemiLight = new HemisphericLight("viewer-hemi", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.95;
  hemiLight.diffuse = new Color3(0.96, 0.97, 0.92);
  hemiLight.groundColor = new Color3(0.18, 0.2, 0.18);

  const sunLight = new DirectionalLight("viewer-sun", new Vector3(-0.4, -1, 0.28), scene);
  sunLight.position = new Vector3(28, 36, -18);
  sunLight.intensity = 0.85;
  sunLight.diffuse = new Color3(1, 0.96, 0.88);

  const ground = MeshBuilder.CreateGround(
    "viewer-ground",
    { width: 128, height: 128, subdivisions: 2 },
    scene
  );
  const groundMaterial = new StandardMaterial("viewer-ground-material", scene);
  groundMaterial.diffuseColor = new Color3(0.44, 0.55, 0.4);
  groundMaterial.emissiveColor = new Color3(0.018, 0.028, 0.018);
  groundMaterial.specularColor = Color3.Black();
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  const assetDefinitions = createAssetDefinitionMap(await loadAssetDefinitions());
  const referencedDefinitions: AssetDefinition[] = Array.from(
    new Set(layoutRecords.map((record) => record.assetId))
  )
    .map((assetId) => assetDefinitions.get(assetId))
    .filter((definition): definition is AssetDefinition => Boolean(definition));

  const assetLibrary = await loadNatureKitAssetLibrary(scene, referencedDefinitions);
  let loadedObjectCount = 0;
  let skippedObjectCount = 0;
  const skippedAssetIds: string[] = [];
  const loadIssues: ViewerLoadIssue[] = [];
  let worldMin: Vector3 | null = null;
  let worldMax: Vector3 | null = null;
  const totalObjectCount = layoutRecords.length;

  onProgress?.({
    totalObjectCount,
    processedObjectCount: 0,
    loadedObjectCount,
    skippedObjectCount
  });

  for (const record of layoutRecords) {
    const definition = assetDefinitions.get(record.assetId);
    if (!definition) {
      console.warn(`Viewer skipped unavailable asset: ${record.assetId}`);
      skippedObjectCount += 1;
      skippedAssetIds.push(record.assetId);
      loadIssues.push({
        type: "missing-asset",
        assetId: record.assetId,
        objectId: record.id,
        message: `Missing asset: ${record.assetId}.`
      });
      onProgress?.({
        totalObjectCount,
        processedObjectCount: loadedObjectCount + skippedObjectCount,
        loadedObjectCount,
        skippedObjectCount
      });
      continue;
    }

    try {
      const root = await assetLibrary.instantiateAsset(
        record.assetId,
        `viewer-${record.id}`,
        new Vector3(record.position.x, record.position.y, record.position.z)
      );

      const meshes = root.getChildMeshes(false).filter((mesh): mesh is Mesh => mesh instanceof Mesh);
      for (const mesh of meshes) {
        enableMeshVertexColors(mesh, { log: true });
      }

      root.position.set(record.position.x, record.position.y, record.position.z);
      root.rotation.set(0, definition.rotationY + degreesToRadians(record.rotationY), 0);
      const finalScale = definition.scale * record.scale;
      root.scaling.set(finalScale, finalScale, finalScale);
      loadedObjectCount += 1;

      const hierarchyBounds = root.getHierarchyBoundingVectors(true);
      worldMin = worldMin ? Vector3.Minimize(worldMin, hierarchyBounds.min) : hierarchyBounds.min.clone();
      worldMax = worldMax ? Vector3.Maximize(worldMax, hierarchyBounds.max) : hierarchyBounds.max.clone();
    } catch (error) {
      console.warn(`Viewer failed to instantiate asset: ${record.assetId}`, error);
      skippedObjectCount += 1;
      skippedAssetIds.push(record.assetId);
      loadIssues.push({
        type: "instantiate-failed",
        assetId: record.assetId,
        objectId: record.id,
        message:
          error instanceof Error
            ? `Could not load ${record.assetId}: ${error.message}`
            : `Could not load ${record.assetId}.`
      });
    }

    onProgress?.({
      totalObjectCount,
      processedObjectCount: loadedObjectCount + skippedObjectCount,
      loadedObjectCount,
      skippedObjectCount
    });
  }

  const worldBounds = worldMin && worldMax ? createWorldBounds(worldMin, worldMax) : null;
  if (worldBounds) {
    developmentCamera.setOverviewFrame(toOverviewFrame(worldBounds), true);
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.key.toLowerCase() !== "r") {
      return;
    }

    developmentCamera.resetOverview(true);
  };

  window.addEventListener("keydown", handleKeyDown);
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", handleKeyDown);
    assetLibrary.dispose();
    developmentCamera.dispose();
  });

  return {
    scene,
    loadedObjectCount,
    skippedObjectCount: skippedObjectCount,
    skippedAssetIds,
    loadIssues,
    worldBounds,
    resetView: () => {
      developmentCamera.resetOverview(true);
    }
  };
}
