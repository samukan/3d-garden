import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";

import { getUploadedAssetBlob } from "../storage/uploadedAssetStore";
import type { AssetDefinition, AssetId } from "./natureKitAssetManifest";

export interface NatureKitAssetLibrary {
  instantiateAsset: (key: AssetId, instanceName: string, position?: Vector3) => Promise<TransformNode>;
  preloadAsset: (key: AssetId) => Promise<void>;
  setDefinitions: (definitions: AssetDefinition[]) => void;
  dispose: () => void;
}

export async function loadNatureKitAssetLibrary(
  scene: Scene,
  definitions: AssetDefinition[]
): Promise<NatureKitAssetLibrary> {
  const containers = new Map<AssetId, AssetContainer>();
  const definitionMap = new Map<AssetId, AssetDefinition>(definitions.map((definition) => [definition.id, definition]));
  const loadingContainers = new Map<AssetId, Promise<AssetContainer>>();
  let disposed = false;

  const loadContainer = async (definition: AssetDefinition): Promise<AssetContainer> => {
    let objectUrl: string | null = null;

    try {
      const assetUrl =
        definition.source.type === "url"
          ? definition.source.url
          : (() => {
              throw new Error("Uploaded assets require a Blob-backed object URL.");
            })();

      return await SceneLoader.LoadAssetContainerAsync("", assetUrl, scene);
    } catch (initialError) {
      if (definition.source.type !== "uploaded") {
        throw initialError;
      }

      const blob = await getUploadedAssetBlob(definition.id);
      if (!blob) {
        throw new Error(`Uploaded asset is no longer available: ${definition.label}.`);
      }

      objectUrl = URL.createObjectURL(blob);
      return SceneLoader.LoadAssetContainerAsync("", objectUrl, scene);
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };

  const ensureContainerLoaded = async (key: AssetId): Promise<AssetContainer> => {
    const existingContainer = containers.get(key);
    if (existingContainer) {
      return existingContainer;
    }

    const existingLoad = loadingContainers.get(key);
    if (existingLoad) {
      return existingLoad;
    }

    const definition = definitionMap.get(key);
    if (!definition) {
      throw new Error(`Asset is not registered: ${key}`);
    }

    const loadingPromise = loadContainer(definition)
      .then((container) => {
        containers.set(key, container);
        loadingContainers.delete(key);
        return container;
      })
      .catch((error) => {
        loadingContainers.delete(key);
        throw error;
      });

    loadingContainers.set(key, loadingPromise);
    return loadingPromise;
  };

  await Promise.all(
    Array.from(definitionMap.values())
      .filter((definition) => definition.source.type === "url")
      .map((definition) => ensureContainerLoaded(definition.id))
  );

  const instantiateAsset = async (key: AssetId, instanceName: string, position = Vector3.Zero()): Promise<TransformNode> => {
    if (disposed) {
      throw new Error("Builder asset library has already been disposed.");
    }

    const definition = definitionMap.get(key);
    if (!definition) {
      throw new Error(`Asset is not registered: ${key}`);
    }

    const container = await ensureContainerLoaded(key);

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
    preloadAsset: async (key) => {
      await ensureContainerLoaded(key);
    },
    setDefinitions: (nextDefinitions) => {
      for (const definition of nextDefinitions) {
        definitionMap.set(definition.id, definition);
      }
    },
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