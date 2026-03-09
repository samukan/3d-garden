import { Color3 } from "@babylonjs/core/Maths/math.color";

export function hexToColor3(hex: string): Color3 {
  const sanitized = hex.replace("#", "");
  const normalized = sanitized.length === 3
    ? sanitized
        .split("")
        .map((segment) => segment + segment)
        .join("")
    : sanitized;

  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return new Color3(red, green, blue);
}