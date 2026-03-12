import { Color3 } from "@babylonjs/core/Maths/math.color";

import type { BiomeID } from "../types/portfolio";
import { hexToColor3 } from "../utils/color";

export interface BiomeTheme {
  id: BiomeID;
  zoneIndex: number;
  label: string;
  groundTint: Color3;
  trunkTint: Color3;
  foliageTint: Color3;
  accentTint: Color3;
  pathTint: Color3;
}

const biomeThemes: Record<BiomeID, BiomeTheme> = {
  "creative-tech": {
    id: "creative-tech",
    zoneIndex: 0,
    label: "Creative Tech",
    groundTint: hexToColor3("#536f67"),
    trunkTint: hexToColor3("#50473a"),
    foliageTint: hexToColor3("#67b7ac"),
    accentTint: hexToColor3("#c7efe0"),
    pathTint: hexToColor3("#8ca28f")
  },
  "ai-systems": {
    id: "ai-systems",
    zoneIndex: 1,
    label: "AI Systems",
    groundTint: hexToColor3("#556873"),
    trunkTint: hexToColor3("#49454b"),
    foliageTint: hexToColor3("#7da8c7"),
    accentTint: hexToColor3("#e2f1ff"),
    pathTint: hexToColor3("#9aa7ad")
  },
  "product-apps": {
    id: "product-apps",
    zoneIndex: 2,
    label: "Product Apps",
    groundTint: hexToColor3("#708154"),
    trunkTint: hexToColor3("#644a36"),
    foliageTint: hexToColor3("#9abf76"),
    accentTint: hexToColor3("#ffd6ac"),
    pathTint: hexToColor3("#a9aa86")
  }
};

export function getBiomeTheme(biomeID: BiomeID): BiomeTheme {
  return biomeThemes[biomeID];
}

export function getBiomeThemeList(): BiomeTheme[] {
  return Object.values(biomeThemes).sort((left, right) => left.zoneIndex - right.zoneIndex);
}
