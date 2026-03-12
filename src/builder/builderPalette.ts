import { natureKitAssetManifest } from "../generation/natureKitAssetManifest";
import type { BuilderPaletteGroup } from "./builderTypes";

const paletteDefinition = [
  {
    id: "ground",
    label: "Ground",
    assetIds: ["groundTile", "cliffBlock", "cliffCorner", "cliffSteps"] as const
  },
  {
    id: "paths",
    label: "Paths",
    assetIds: ["pathStraight", "pathTile", "pathEnd"] as const
  },
  {
    id: "trees",
    label: "Trees",
    assetIds: ["tree"] as const
  },
  {
    id: "plants",
    label: "Plants",
    assetIds: ["bush"] as const
  },
  {
    id: "rocks",
    label: "Rocks",
    assetIds: ["rock"] as const
  },
  {
    id: "props",
    label: "Props",
    assetIds: ["focalProp"] as const
  }
] as const;

export function getBuilderPalette(): BuilderPaletteGroup[] {
  return paletteDefinition.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.assetIds.map((assetId) => ({
      assetId,
      label: natureKitAssetManifest[assetId].label
    }))
  }));
}