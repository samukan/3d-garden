import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
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
  evictAssets: (keys: AssetId[]) => Promise<void>;
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
  const uploadedObjectUrls = new Map<AssetId, string>();
  let disposed = false;

  const loadContainer = async (definition: AssetDefinition): Promise<AssetContainer> => {
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

      const existingUrl = uploadedObjectUrls.get(definition.id);
      const objectUrl = existingUrl ?? URL.createObjectURL(blob);
      if (!existingUrl) {
        uploadedObjectUrls.set(definition.id, objectUrl);
      }

      return SceneLoader.LoadAssetContainerAsync("", objectUrl, scene, undefined, ".glb");
    }
  };

  const revokeUploadedUrl = (key: AssetId): void => {
    const objectUrl = uploadedObjectUrls.get(key);
    if (!objectUrl) {
      return;
    }

    URL.revokeObjectURL(objectUrl);
    uploadedObjectUrls.delete(key);
  };

  const disposeContainer = (key: AssetId): void => {
    const container = containers.get(key);
    if (container) {
      container.dispose();
      containers.delete(key);
    }

    loadingContainers.delete(key);
    revokeUploadedUrl(key);
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

  // Keep startup non-blocking so a transient asset fetch failure cannot blank the entire builder boot flow.

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
    evictAssets: async (keys) => {
      const uniqueKeys = Array.from(new Set(keys));
      for (const key of uniqueKeys) {
        const loading = loadingContainers.get(key);
        if (loading) {
          try {
            await loading;
          } catch {
            // Ignore failures during eviction.
          }
        }
        disposeContainer(key);
      }
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
      loadingContainers.clear();
      for (const key of Array.from(uploadedObjectUrls.keys())) {
        revokeUploadedUrl(key);
      }
    }
  };
}
