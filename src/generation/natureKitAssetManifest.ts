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

export type NatureKitAssetKey = (typeof natureKitAssetKeys)[number];

export interface NatureKitAssetDefinition {
  key: NatureKitAssetKey;
  label: string;
  url: string;
  scale: number;
  rotationY: number;
}

export const natureKitAssetManifest: Record<NatureKitAssetKey, NatureKitAssetDefinition> = {
  groundTile: {
    key: "groundTile",
    label: "Ground Grass",
    url: "/assets/nature-kit/Models/GLTF format/ground_grass.glb",
    scale: 2,
    rotationY: 0
  },
  pathStraight: {
    key: "pathStraight",
    label: "Path Straight",
    url: "/assets/nature-kit/Models/GLTF format/ground_pathStraight.glb",
    scale: 2,
    rotationY: 0
  },
  pathTile: {
    key: "pathTile",
    label: "Path Tile",
    url: "/assets/nature-kit/Models/GLTF format/ground_pathTile.glb",
    scale: 2,
    rotationY: 0
  },
  pathEnd: {
    key: "pathEnd",
    label: "Path End",
    url: "/assets/nature-kit/Models/GLTF format/ground_pathEnd.glb",
    scale: 2,
    rotationY: 0
  },
  cliffBlock: {
    key: "cliffBlock",
    label: "Cliff Block Stone",
    url: "/assets/nature-kit/Models/GLTF format/cliff_block_stone.glb",
    scale: 1.55,
    rotationY: 0
  },
  cliffCorner: {
    key: "cliffCorner",
    label: "Cliff Corner Stone",
    url: "/assets/nature-kit/Models/GLTF format/cliff_corner_stone.glb",
    scale: 1.55,
    rotationY: 0
  },
  cliffSteps: {
    key: "cliffSteps",
    label: "Cliff Steps Stone",
    url: "/assets/nature-kit/Models/GLTF format/cliff_steps_stone.glb",
    scale: 1.55,
    rotationY: 0
  },
  tree: {
    key: "tree",
    label: "Tree Oak",
    url: "/assets/nature-kit/Models/GLTF format/tree_oak.glb",
    scale: 1.8,
    rotationY: 0
  },
  bush: {
    key: "bush",
    label: "Bush Detailed",
    url: "/assets/nature-kit/Models/GLTF format/plant_bushDetailed.glb",
    scale: 1.4,
    rotationY: 0
  },
  rock: {
    key: "rock",
    label: "Rock Small A",
    url: "/assets/nature-kit/Models/GLTF format/rock_smallA.glb",
    scale: 1.35,
    rotationY: 0
  },
  focalProp: {
    key: "focalProp",
    label: "Sign",
    url: "/assets/nature-kit/Models/GLTF format/sign.glb",
    scale: 1.6,
    rotationY: 0
  }
};

export const natureKitPreviewOrder: NatureKitAssetKey[] = ["tree", "bush", "rock", "focalProp"];