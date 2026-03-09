import "./style.css";

import portfolioSource from "./data/portfolio.json";
import { createScene } from "./engine/createScene";
import { initEngine } from "./engine/initEngine";
import type { QualityMode } from "./engine/sceneState";
import { createProjectOverlay } from "./ui/overlay";
import { createQualityToggle } from "./ui/qualityToggle";
import { createStatusBar } from "./ui/statusBar";
import { validatePortfolioData } from "./utils/validation";

async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
  const statusElement = document.querySelector<HTMLElement>("#status-badge");
  const qualityButton = document.querySelector<HTMLButtonElement>("#quality-toggle");
  const projectCard = document.querySelector<HTMLElement>("#project-card");

  if (!canvas || !statusElement || !qualityButton || !projectCard) {
    throw new Error("Skill Garden could not find the required DOM elements.");
  }

  const items = validatePortfolioData(portfolioSource);
  const overlay = createProjectOverlay(projectCard);
  const statusBar = createStatusBar(statusElement);

  const initialQuality: QualityMode = window.innerWidth < 960 ? "low" : "high";
  statusBar.setQuality(initialQuality);

  const { engine, renderer } = await initEngine(canvas);
  statusBar.setRenderer(renderer);

  const sceneController = await createScene({
    canvas,
    engine,
    items,
    initialQuality,
    onProjectSelected: (project) => {
      if (project) {
        overlay.showProject(project);
        return;
      }

      overlay.showDefault();
    }
  });

  createQualityToggle(qualityButton, initialQuality, (quality) => {
    sceneController.setQuality(quality);
    statusBar.setQuality(quality);
  });

  let lastFpsRefresh = 0;

  engine.runRenderLoop(() => {
    sceneController.scene.render();

    const now = performance.now();
    if (now - lastFpsRefresh > 250) {
      lastFpsRefresh = now;
      statusBar.setFps(engine.getFps());
    }
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}

bootstrap().catch((error: unknown) => {
  const projectCard = document.querySelector<HTMLElement>("#project-card");
  if (projectCard) {
    projectCard.innerHTML = `
      <p class="eyebrow">Startup error</p>
      <h2>Skill Garden could not boot</h2>
      <p>Check the console for details.</p>
    `;
  }

  console.error(error);
});
