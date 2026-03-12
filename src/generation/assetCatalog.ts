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
  return [...getBuiltInAssetDefinitions(), ...(await listUploadedAssetDefinitions())];
}