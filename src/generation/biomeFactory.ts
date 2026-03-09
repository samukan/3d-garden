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
}

const biomeThemes: Record<BiomeID, BiomeTheme> = {
  meadow: {
    id: "meadow",
    zoneIndex: 0,
    label: "Meadow",
    groundTint: hexToColor3("#6f9b58"),
    trunkTint: hexToColor3("#755031"),
    foliageTint: hexToColor3("#7bc276"),
    accentTint: hexToColor3("#ffd36a")
  },
  orchard: {
    id: "orchard",
    zoneIndex: 1,
    label: "Orchard",
    groundTint: hexToColor3("#627346"),
    trunkTint: hexToColor3("#6d402d"),
    foliageTint: hexToColor3("#d58b64"),
    accentTint: hexToColor3("#ffe6ae")
  }
};

export function getBiomeTheme(biomeID: BiomeID): BiomeTheme {
  return biomeThemes[biomeID];
}

export function getBiomeThemeList(): BiomeTheme[] {
  return Object.values(biomeThemes).sort((left, right) => left.zoneIndex - right.zoneIndex);
}
