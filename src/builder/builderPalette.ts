import type { AssetDefinition } from "../generation/natureKitAssetManifest";
import type { BuilderPaletteGroup } from "./builderTypes";

const groupOrder = ["ground", "paths", "trees", "plants", "rocks", "props", "uploads"];
const assetOrder = [
  "groundTile",
  "cliffBlock",
  "cliffCorner",
  "cliffSteps",
  "pathStraight",
  "pathTile",
  "pathEnd",
  "tree",
  "bush",
  "rock",
  "focalProp"
];

const assetOrderIndex = new Map(assetOrder.map((assetId, index) => [assetId, index]));
const groupOrderIndex = new Map(groupOrder.map((groupId, index) => [groupId, index]));

export function getBuilderPalette(assetDefinitions: AssetDefinition[]): BuilderPaletteGroup[] {
  const grouped = new Map<string, BuilderPaletteGroup>();

  for (const definition of assetDefinitions) {
    const existingGroup = grouped.get(definition.groupId);
    if (existingGroup) {
      existingGroup.items.push({
        assetId: definition.id,
        label: definition.label
      });
      continue;
    }

    grouped.set(definition.groupId, {
      id: definition.groupId,
      label: definition.groupLabel,
      items: [
        {
          assetId: definition.id,
          label: definition.label
        }
      ]
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      const leftIndex = groupOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = groupOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.label.localeCompare(right.label);
    })
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((left, right) => {
        const leftIndex = assetOrderIndex.get(left.assetId) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = assetOrderIndex.get(right.assetId) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }

        return left.label.localeCompare(right.label);
      })
    }));
}