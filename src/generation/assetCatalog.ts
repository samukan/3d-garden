import { listUploadedAssetDefinitions } from "../storage/uploadedAssetStore";
import {
  getBuiltInAssetDefinitions,
  type AssetDefinition,
  type AssetId
} from "./natureKitAssetManifest";

export function createAssetDefinitionMap(definitions: AssetDefinition[]): Map<AssetId, AssetDefinition> {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

export function getAssetLabel(definitions: Map<AssetId, AssetDefinition>, assetId: AssetId): string {
  return definitions.get(assetId)?.label ?? assetId;
}

export async function loadAssetDefinitions(): Promise<AssetDefinition[]> {
  try {
    return [...getBuiltInAssetDefinitions(), ...(await listUploadedAssetDefinitions())];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uploaded assets are not available.";
    console.warn(message);
    return getBuiltInAssetDefinitions();
  }
}
