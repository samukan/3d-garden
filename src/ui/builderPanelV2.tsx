import { createRoot, type Root } from "react-dom/client";

import type { SceneBuilderController } from "../builder/sceneBuilder";
import { BuilderShellApp } from "../editor-shell/BuilderShellApp";
import { createSceneBuilderAdapter } from "../editor-shell/sceneBuilderAdapter";
import type { BuilderPanelController, CreateBuilderPanelOptions } from "./builderPanel";

export function createBuilderPanelV2(
  element: HTMLElement,
  sceneBuilder: SceneBuilderController,
  options: CreateBuilderPanelOptions
): BuilderPanelController {
  const topBar = element.querySelector<HTMLElement>("#builder-top-bar");
  const toastHost = element.querySelector<HTMLElement>("#builder-toast-host");
  const libraryPanel = element.querySelector<HTMLElement>("#builder-library-panel");
  const inspectorPanel = element.querySelector<HTMLElement>("#builder-inspector-panel");

  if (!topBar || !toastHost || !libraryPanel || !inspectorPanel) {
    throw new Error("Builder v2 shell could not find required layout containers.");
  }

  topBar.innerHTML = "";
  toastHost.innerHTML = "";
  libraryPanel.innerHTML = "";
  inspectorPanel.innerHTML = "";

  const existingRolloutPanel = element.querySelector<HTMLElement>("#builder-rollout-panel");
  existingRolloutPanel?.remove();

  element.hidden = false;

  const adapter = createSceneBuilderAdapter(sceneBuilder, options);
  const root: Root = createRoot(topBar);

  root.render(
    <BuilderShellApp
      adapter={adapter}
      hosts={{
        libraryPanel,
        inspectorPanel,
        toastHost
      }}
    />
  );

  return {
    dispose: () => {
      root.unmount();
      adapter.dispose();
      topBar.innerHTML = "";
      toastHost.innerHTML = "";
      libraryPanel.innerHTML = "";
      inspectorPanel.innerHTML = "";
    },
    setWorldState: (state) => {
      adapter.setWorldState(state);
    }
  };
}
