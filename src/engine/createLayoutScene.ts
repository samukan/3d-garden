import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { Material } from "@babylonjs/core/Materials/material";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";

import type { BuilderLayoutRecord } from "../builder/builderTypes";
import type { AssetDefinition } from "../generation/natureKitAssetManifest";
import { createAssetDefinitionMap, loadAssetDefinitions } from "../generation/assetCatalog";
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";
import { degreesToRadians } from "../utils/angle";
import { logBrowserDebug } from "../utils/browserDebug";
import { enableMeshVertexColors } from "../utils/meshColors";
import type { ViewerLoadIssue, ViewerWorldBounds } from "../viewer/viewerTypes";
import {
  createViewerCameraRig,
  type CameraOverviewFrame,
  type ViewerCameraMode
} from "./viewerCameraRig";

interface CreateLayoutSceneOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
  layoutRecords: BuilderLayoutRecord[];
  atmosphereProfile?: ViewerAtmosphereProfile;
  cameraPresentationProfile?: ViewerCameraPresentationProfile;
  enableDevFreeCamera?: boolean;
  onProgress?: (progress: {
    totalObjectCount: number;
    processedObjectCount: number;
    loadedObjectCount: number;
    skippedObjectCount: number;
  }) => void;
  onCameraModeChange?: (mode: ViewerCameraMode) => void;
}

export interface LayoutSceneController {
  scene: Scene;
  loadedObjectCount: number;
  skippedObjectCount: number;
  skippedAssetIds: string[];
  loadIssues: ViewerLoadIssue[];
  worldBounds: ViewerWorldBounds | null;
  getCameraMode: () => ViewerCameraMode;
  setCameraMode: (mode: ViewerCameraMode) => ViewerCameraMode;
  toggleCameraMode: () => ViewerCameraMode;
  canUseDevFreeCamera: () => boolean;
  resetView: () => void;
}

export type ViewerAtmosphereProfile = "default" | "ekaPresentation";
export type ViewerCameraPresentationProfile = "default" | "ekaShowcase";

interface MaterialTintProfile {
  key: "grass" | "cliff" | "path";
  diffuseMultiplier: Color3;
}

interface HeroFocusCandidate {
  center: Vector3;
  height: number;
  treePriority: number;
}

type TintableMaterial = Material & {
  diffuseColor?: Color3;
  albedoColor?: Color3;
  emissiveColor?: Color3;
};

const GRASS_TINT_PROFILE: MaterialTintProfile = {
  key: "grass",
  diffuseMultiplier: new Color3(0.92, 1.03, 0.9)
};

const CLIFF_TINT_PROFILE: MaterialTintProfile = {
  key: "cliff",
  diffuseMultiplier: new Color3(0.86, 0.8, 0.72)
};

const PATH_TINT_PROFILE: MaterialTintProfile = {
  key: "path",
  diffuseMultiplier: new Color3(1.04, 0.97, 0.86)
};

function resolveTintProfile(assetId: string): MaterialTintProfile | null {
  if (assetId === "groundTile") {
    return GRASS_TINT_PROFILE;
  }

  if (assetId === "cliffBlock" || assetId === "cliffCorner" || assetId === "cliffSteps") {
    return CLIFF_TINT_PROFILE;
  }

  if (assetId === "pathStraight" || assetId === "pathTile" || assetId === "pathEnd") {
    return PATH_TINT_PROFILE;
  }

  return null;
}

function applyTintToMaterial(material: Material, tint: MaterialTintProfile): void {
  const tintable = material as TintableMaterial;
  if (tintable.diffuseColor) {
    tintable.diffuseColor = tintable.diffuseColor.multiply(tint.diffuseMultiplier);
  }

  if (tintable.albedoColor) {
    tintable.albedoColor = tintable.albedoColor.multiply(tint.diffuseMultiplier);
  }

  if (tintable.emissiveColor) {
    tintable.emissiveColor = tintable.emissiveColor.scale(0.85);
  }
}

function getTintedMaterial(
  baseMaterial: Material,
  tint: MaterialTintProfile,
  cache: Map<string, Material>
): Material {
  const cacheKey = `${baseMaterial.uniqueId}:${tint.key}`;
  const cachedMaterial = cache.get(cacheKey);
  if (cachedMaterial) {
    return cachedMaterial;
  }

  let tintedMaterial: Material | null = null;

  if (baseMaterial instanceof MultiMaterial) {
    const clonedMulti = baseMaterial.clone(`${baseMaterial.name}-${tint.key}`);
    if (clonedMulti) {
      clonedMulti.subMaterials = (baseMaterial.subMaterials ?? []).map((subMaterial) => {
        if (!subMaterial) {
          return null;
        }

        return getTintedMaterial(subMaterial, tint, cache);
      });
      tintedMaterial = clonedMulti;
    }
  } else {
    const clonedMaterial = baseMaterial.clone(`${baseMaterial.name}-${tint.key}`);
    if (clonedMaterial) {
      applyTintToMaterial(clonedMaterial, tint);
      tintedMaterial = clonedMaterial;
    }
  }

  if (!tintedMaterial) {
    return baseMaterial;
  }

  cache.set(cacheKey, tintedMaterial);
  return tintedMaterial;
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
  atmosphereProfile = "default",
  cameraPresentationProfile = "default",
  enableDevFreeCamera = false,
  onProgress,
  onCameraModeChange
}: CreateLayoutSceneOptions): Promise<LayoutSceneController> {
  const scene = new Scene(engine);
  const viewerCameraRig = createViewerCameraRig(scene, canvas, {
    enableDevFreeCamera
  });
  scene.activeCamera = viewerCameraRig.camera;

  const useEkaPresentation = atmosphereProfile === "ekaPresentation";

  scene.clearColor = useEkaPresentation
    ? new Color4(0.93, 0.89, 0.83, 1)
    : new Color4(0.79, 0.87, 0.92, 1);
  scene.ambientColor = useEkaPresentation
    ? new Color3(0.25, 0.21, 0.18)
    : new Color3(0.2, 0.24, 0.22);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = useEkaPresentation ? 0.006 : 0.0056;
  scene.fogColor = useEkaPresentation
    ? new Color3(0.9, 0.84, 0.78)
    : new Color3(0.86, 0.91, 0.9);

  const hemiLight = new HemisphericLight("viewer-hemi", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = useEkaPresentation ? 0.72 : 0.95;
  hemiLight.diffuse = useEkaPresentation
    ? new Color3(1, 0.95, 0.86)
    : new Color3(0.96, 0.97, 0.92);
  hemiLight.groundColor = useEkaPresentation
    ? new Color3(0.2, 0.16, 0.12)
    : new Color3(0.18, 0.2, 0.18);

  const sunLight = new DirectionalLight(
    "viewer-sun",
    useEkaPresentation ? new Vector3(-0.58, -1, 0.22) : new Vector3(-0.4, -1, 0.28),
    scene
  );
  sunLight.position = useEkaPresentation ? new Vector3(34, 40, -10) : new Vector3(28, 36, -18);
  sunLight.intensity = useEkaPresentation ? 0.98 : 0.85;
  sunLight.diffuse = useEkaPresentation ? new Color3(1, 0.9, 0.74) : new Color3(1, 0.96, 0.88);

  const ground = MeshBuilder.CreateGround(
    "viewer-ground",
    { width: 128, height: 128, subdivisions: 2 },
    scene
  );
  const groundMaterial = new StandardMaterial("viewer-ground-material", scene);
  groundMaterial.diffuseColor = useEkaPresentation
    ? new Color3(0.43, 0.48, 0.39)
    : new Color3(0.44, 0.55, 0.4);
  groundMaterial.emissiveColor = useEkaPresentation
    ? new Color3(0.014, 0.018, 0.013)
    : new Color3(0.018, 0.028, 0.018);
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
  const tintedMaterialCache = new Map<string, Material>();
  const heroFocusCandidates: HeroFocusCandidate[] = [];
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
      const tintProfile = useEkaPresentation ? resolveTintProfile(record.assetId) : null;
      for (const mesh of meshes) {
        if (tintProfile && mesh.material) {
          mesh.material = getTintedMaterial(mesh.material, tintProfile, tintedMaterialCache);
        }
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

      const assetIdLower = record.assetId.toLowerCase();
      const treePriority = definition.groupId === "trees" ? 2 : assetIdLower.includes("tree") ? 1 : 0;
      if (treePriority > 0) {
        heroFocusCandidates.push({
          center: hierarchyBounds.min.add(hierarchyBounds.max).scale(0.5),
          height: Math.max(0.5, hierarchyBounds.max.y - hierarchyBounds.min.y),
          treePriority
        });
      }
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
    viewerCameraRig.setOverviewFrame(toOverviewFrame(worldBounds), true);
  }

  const emitCameraModeChange = (): void => {
    onCameraModeChange?.(viewerCameraRig.getMode());
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();
    const isReset = key === "r";
    const isModeToggle = key === "f" && event.shiftKey && viewerCameraRig.canUseDevFree();

    if (!isReset && !isModeToggle) {
      viewerCameraRig.cancelCinematic("keyboard");
      return;
    }

    if (isReset) {
      viewerCameraRig.cancelCinematic("keyboard-reset");
      viewerCameraRig.resetView(true);
      emitCameraModeChange();
      return;
    }

    if (isModeToggle) {
      viewerCameraRig.cancelCinematic("keyboard-mode-toggle");
      event.preventDefault();
      viewerCameraRig.toggleMode();
      emitCameraModeChange();
    }
  };

  const handlePointerDown = (): void => {
    viewerCameraRig.cancelCinematic("pointerdown");
  };

  const handleWheel = (): void => {
    viewerCameraRig.cancelCinematic("wheel");
  };

  if (cameraPresentationProfile === "ekaShowcase" && worldBounds) {
    const orbitTarget = new Vector3(worldBounds.center.x, Math.max(0.5, worldBounds.center.y), worldBounds.center.z);
    logBrowserDebug("viewer-cinematic:profile-applied", {
      cameraPresentationProfile,
      heroCandidateCount: heroFocusCandidates.length,
      orbitTarget: {
        x: Number(orbitTarget.x.toFixed(2)),
        y: Number(orbitTarget.y.toFixed(2)),
        z: Number(orbitTarget.z.toFixed(2))
      }
    });
    viewerCameraRig.startCinematic({
      preset: "microSmallWorld",
      heroTarget: orbitTarget,
      heroHeight: Math.max(1, worldBounds.size.y),
      revealDurationMs: 4200,
      settleDurationMs: 0,
      holdDurationMs: 0
    });
  }

  window.addEventListener("keydown", handleKeyDown);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("wheel", handleWheel, { passive: true });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", handleKeyDown);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("wheel", handleWheel);
    assetLibrary.dispose();
    viewerCameraRig.dispose();
  });

  return {
    scene,
    loadedObjectCount,
    skippedObjectCount: skippedObjectCount,
    skippedAssetIds,
    loadIssues,
    worldBounds,
    getCameraMode: () => viewerCameraRig.getMode(),
    setCameraMode: (mode) => {
      const nextMode = viewerCameraRig.setMode(mode);
      emitCameraModeChange();
      return nextMode;
    },
    toggleCameraMode: () => {
      const nextMode = viewerCameraRig.toggleMode();
      emitCameraModeChange();
      return nextMode;
    },
    canUseDevFreeCamera: () => viewerCameraRig.canUseDevFree(),
    resetView: () => {
      viewerCameraRig.resetView(true);
      emitCameraModeChange();
    }
  };
}
