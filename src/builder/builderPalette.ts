import type { AssetDefinition } from "../generation/natureKitAssetManifest";
import type { BuilderPaletteItem } from "./builderTypes";

export function getBuilderPalette(assetDefinitions: AssetDefinition[]): BuilderPaletteItem[] {
  return assetDefinitions
    .map((definition) => {
      if (definition.source.type === "uploaded") {
        return {
          assetId: definition.id,
          label: definition.label,
          sourceType: "uploaded" as const,
          uploadedAt: definition.source.uploadedAt,
          uploadedCategory: definition.source.category
        };
      }

      return {
        assetId: definition.id,
        label: definition.label,
        sourceType: "built-in" as const,
        uploadedAt: null,
        uploadedCategory: null
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}
