import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

import type { BuilderLayoutRecord } from "../builder/builderTypes";
import { createDevelopmentCamera } from "./developmentCamera";
import { createAssetDefinitionMap, loadAssetDefinitions } from "../generation/assetCatalog";
import { loadNatureKitAssetLibrary } from "../generation/NatureKitAssetLoader";

interface CreateLayoutSceneOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
  layoutRecords: BuilderLayoutRecord[];
}

export interface LayoutSceneController {
  scene: Scene;
}

export async function createLayoutScene({
  canvas,
  engine,
  layoutRecords
}: CreateLayoutSceneOptions): Promise<LayoutSceneController> {
  const scene = new Scene(engine);
  const developmentCamera = createDevelopmentCamera(scene, canvas);

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
  const assetLibrary = await loadNatureKitAssetLibrary(scene, Array.from(assetDefinitions.values()));

  for (const record of layoutRecords) {
    const definition = assetDefinitions.get(record.assetId);
    if (!definition) {
      console.warn(`Viewer skipped unavailable asset: ${record.assetId}`);
      continue;
    }

    const root = await assetLibrary.instantiateAsset(
      record.assetId,
      `viewer-${record.id}`,
      new Vector3(record.position.x, record.position.y, record.position.z)
    );

    root.position.set(record.position.x, record.position.y, record.position.z);
    root.rotation.set(0, definition.rotationY + record.rotationY, 0);
    const finalScale = definition.scale * record.scale;
    root.scaling.set(finalScale, finalScale, finalScale);
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
    scene
  };
}