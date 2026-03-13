export type AssetId = string;
export const DEFAULT_UPLOADED_ASSET_CATEGORY = "Uncategorized";

export interface AssetDefinition {
  id: AssetId;
  label: string;
  scale: number;
  rotationY: number;
  groupId: string;
  groupLabel: string;
  source:
    | {
        type: "url";
        url: string;
      }
    | {
        type: "uploaded";
        category: string;
        uploadedAt: string;
      };
}

export const natureKitAssetKeys = [
  "groundTile",
  "pathStraight",
  "pathTile",
  "pathEnd",
  "cliffBlock",
  "cliffCorner",
  "cliffSteps",
  "tree",
  "bush",
  "rock",
  "focalProp"
] as const;

export type BuiltInNatureKitAssetKey = (typeof natureKitAssetKeys)[number];
export type NatureKitAssetKey = AssetId;

export const natureKitAssetManifest: Record<BuiltInNatureKitAssetKey, AssetDefinition> = {
  groundTile: {
    id: "groundTile",
    label: "Ground Grass",
    scale: 2,
    rotationY: 0,
    groupId: "ground",
    groupLabel: "Ground",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/ground_grass.glb"
    }
  },
  pathStraight: {
    id: "pathStraight",
    label: "Path Straight",
    scale: 2,
    rotationY: 0,
    groupId: "paths",
    groupLabel: "Paths",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/ground_pathStraight.glb"
    }
  },
  pathTile: {
    id: "pathTile",
    label: "Path Tile",
    scale: 2,
    rotationY: 0,
    groupId: "paths",
    groupLabel: "Paths",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/ground_pathTile.glb"
    }
  },
  pathEnd: {
    id: "pathEnd",
    label: "Path End",
    scale: 2,
    rotationY: 0,
    groupId: "paths",
    groupLabel: "Paths",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/ground_pathEnd.glb"
    }
  },
  cliffBlock: {
    id: "cliffBlock",
    label: "Cliff Block Stone",
    scale: 1.55,
    rotationY: 0,
    groupId: "ground",
    groupLabel: "Ground",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/cliff_block_stone.glb"
    }
  },
  cliffCorner: {
    id: "cliffCorner",
    label: "Cliff Corner Stone",
    scale: 1.55,
    rotationY: 0,
    groupId: "ground",
    groupLabel: "Ground",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/cliff_corner_stone.glb"
    }
  },
  cliffSteps: {
    id: "cliffSteps",
    label: "Cliff Steps Stone",
    scale: 1.55,
    rotationY: 0,
    groupId: "ground",
    groupLabel: "Ground",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/cliff_steps_stone.glb"
    }
  },
  tree: {
    id: "tree",
    label: "Tree Oak",
    scale: 1.8,
    rotationY: 0,
    groupId: "trees",
    groupLabel: "Trees",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/tree_oak.glb"
    }
  },
  bush: {
    id: "bush",
    label: "Bush Detailed",
    scale: 1.4,
    rotationY: 0,
    groupId: "plants",
    groupLabel: "Plants",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/plant_bushDetailed.glb"
    }
  },
  rock: {
    id: "rock",
    label: "Rock Small A",
    scale: 1.35,
    rotationY: 0,
    groupId: "rocks",
    groupLabel: "Rocks",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/rock_smallA.glb"
    }
  },
  focalProp: {
    id: "focalProp",
    label: "Sign",
    scale: 1.6,
    rotationY: 0,
    groupId: "props",
    groupLabel: "Props",
    source: {
      type: "url",
      url: "/assets/nature-kit/Models/GLTF format/sign.glb"
    }
  }
};

export function getBuiltInAssetDefinitions(): AssetDefinition[] {
  return Object.values(natureKitAssetManifest);
}

export const natureKitPreviewOrder: BuiltInNatureKitAssetKey[] = ["tree", "bush", "rock", "focalProp"];
