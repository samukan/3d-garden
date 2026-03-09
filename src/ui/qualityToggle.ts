import type { QualityMode } from "../engine/sceneState";

export interface QualityToggleController {
  setQuality: (quality: QualityMode) => void;
}

export function createQualityToggle(
  button: HTMLButtonElement,
  initialQuality: QualityMode,
  onToggle: (quality: QualityMode) => void
): QualityToggleController {
  let currentQuality = initialQuality;

  const render = (): void => {
    button.textContent = `Quality: ${currentQuality === "high" ? "High" : "Low"}`;
    button.setAttribute("aria-pressed", String(currentQuality === "high"));
  };

  button.addEventListener("click", () => {
    currentQuality = currentQuality === "high" ? "low" : "high";
    render();
    onToggle(currentQuality);
  });

  render();

  return {
    setQuality: (quality) => {
      currentQuality = quality;
      render();
    }
  };
}
