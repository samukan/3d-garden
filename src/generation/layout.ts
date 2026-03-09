import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { PortfolioItem } from "../types/portfolio";
import { getBiomeThemeList } from "./biomeFactory";

const zoneSpacing = 24;
const yearSpacing = 8;
const laneSpacing = 4.5;

export function buildProjectLayout(items: PortfolioItem[]): Map<string, Vector3> {
  const positions = new Map<string, Vector3>();
  const themes = getBiomeThemeList();
  const yearValues = items.map((item) => item.year);
  const minYear = Math.min(...yearValues);
  const maxYear = Math.max(...yearValues);
  const midpointYear = (minYear + maxYear) / 2;

  for (const theme of themes) {
    const zoneItems = items
      .filter((item) => item.biomeID === theme.id)
      .sort((left, right) => left.year - right.year || left.title.localeCompare(right.title));

    zoneItems.forEach((item, index) => {
      const yearOffset = (item.year - midpointYear) * yearSpacing;
      const laneOffset = ((index % 3) - 1) * laneSpacing;
      const depthOffset = Math.floor(index / 3) * 2.3;
      const zoneCenter = (theme.zoneIndex - (themes.length - 1) / 2) * zoneSpacing;
      const zOffset = maxYear === minYear ? 0 : yearOffset + depthOffset;

      positions.set(item.id, new Vector3(zoneCenter + laneOffset, 0, zOffset));
    });
  }

  return positions;
}
