import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";

import {
  natureKitAssetManifest,
  type NatureKitAssetKey
} from "./natureKitAssetManifest";

export interface NatureKitAssetLibrary {
  instantiateAsset: (key: NatureKitAssetKey, instanceName: string, position?: Vector3) => TransformNode;
  dispose: () => void;
}

export async function loadNatureKitAssetLibrary(scene: Scene): Promise<NatureKitAssetLibrary> {
  const containers = new Map<NatureKitAssetKey, AssetContainer>();
  let disposed = false;

  await Promise.all(
    Object.values(natureKitAssetManifest).map(async (definition) => {
      const container = await SceneLoader.LoadAssetContainerAsync("", definition.url, scene);
      containers.set(definition.key, container);
    })
  );

  const instantiateAsset = (key: NatureKitAssetKey, instanceName: string, position = Vector3.Zero()): TransformNode => {
    if (disposed) {
      throw new Error("Kenney slice asset library has already been disposed.");
    }

    const definition = natureKitAssetManifest[key];
    const container = containers.get(key);

    if (!container) {
      throw new Error(`Kenney slice asset is not loaded: ${key}`);
    }

    const root = new TransformNode(instanceName, scene);
    root.position.copyFrom(position);
    root.scaling = new Vector3(definition.scale, definition.scale, definition.scale);
    root.rotation = new Vector3(0, definition.rotationY, 0);

    const instantiated = container.instantiateModelsToScene((sourceName) => `${instanceName}-${sourceName}`, false);
    for (const node of instantiated.rootNodes) {
      node.parent = root;
    }

    return root;
  };

  return {
    instantiateAsset,
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      containers.forEach((container) => container.dispose());
      containers.clear();
    }
  };
}