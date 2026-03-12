import type { AssetDefinition } from "../generation/natureKitAssetManifest";
import type { BuilderPaletteItem } from "./builderTypes";

export function getBuilderPalette(assetDefinitions: AssetDefinition[]): BuilderPaletteItem[] {
  return assetDefinitions
    .map((definition) => ({
      assetId: definition.id,
      label: definition.label
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}