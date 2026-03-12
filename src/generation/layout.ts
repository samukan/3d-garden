import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { PortfolioItem } from "../types/portfolio";
import type { BiomeID } from "../types/portfolio";
import { getBiomeThemeList } from "./biomeFactory";

const zoneSpacing = 23;

const zoneCenters: Record<BiomeID, Vector3> = {
  "creative-tech": new Vector3(-20, 0, -4),
  "ai-systems": new Vector3(0, 0, 18),
  "product-apps": new Vector3(20, 0, -4)
};

export function getZoneCenters(): Map<BiomeID, Vector3> {
  return new Map(Object.entries(zoneCenters) as Array<[BiomeID, Vector3]>);
}

export function buildProjectLayout(items: PortfolioItem[]): Map<string, Vector3> {
  const positions = new Map<string, Vector3>();
  const themes = getBiomeThemeList();

  for (const theme of themes) {
    const zoneItems = items
      .filter((item) => item.biomeID === theme.id)
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));

    const zoneCenter = zoneCenters[theme.id] ?? new Vector3((theme.zoneIndex - 1) * zoneSpacing, 0, 0);

    zoneItems.forEach((item, index) => {
      if (theme.id === "creative-tech") {
        positions.set(item.id, new Vector3(zoneCenter.x + 0.5, 0, zoneCenter.z + 0.8));
        return;
      }

      if (theme.id === "ai-systems") {
        positions.set(item.id, new Vector3(zoneCenter.x + (index - 1) * 6.3, 0, zoneCenter.z + index * 1.4));
        return;
      }

      const row = Math.floor(index / 2);
      const direction = index % 2 === 0 ? -1 : 1;
      const xOffset = direction * (4.6 + row * 1.8);
      const zOffset = row * 3.5 + (index % 2 === 0 ? 1 : -0.6);
      positions.set(item.id, new Vector3(zoneCenter.x + xOffset, 0, zoneCenter.z + zOffset));
    });
  }

  return positions;
}
