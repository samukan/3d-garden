import type { ViewerLoadState } from "../viewer/viewerTypes";
import { escapeHtml } from "../utils/html";

export interface ViewerPanelState {
  loadState: ViewerLoadState;
  title: string;
  sourceLabel: string;
  objectCount: number;
  loadedObjectCount: number;
  skippedObjectCount: number;
  updatedAtLabel: string;
  message: string | null;
  issues: string[];
  canResetView: boolean;
}

export interface ViewerPanelController {
  dispose: () => void;
  setState: (state: ViewerPanelState) => void;
}

export interface CreateViewerPanelOptions {
  onResetView: () => void;
  state: ViewerPanelState;
}

function loadStateLabel(loadState: ViewerLoadState): string {
  if (loadState === "loading") {
    return "Loading";
  }

  if (loadState === "partial") {
    return "Partially Loaded";
  }

  if (loadState === "error") {
    return "Unavailable";
  }

  return "Ready";
}

export function createViewerPanel(element: HTMLElement, options: CreateViewerPanelOptions): ViewerPanelController {
  let state = { ...options.state };

  const renderIssues = (): string => {
    if (state.issues.length === 0) {
      return "";
    }

    return `
      <div class="viewer-panel-section">
        <p class="viewer-panel-label">Diagnostics</p>
        <ul class="viewer-issue-list">
          ${state.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}
        </ul>
      </div>
    `;
  };

  const render = (): void => {
    element.dataset.viewerLoadState = state.loadState;
    element.innerHTML = `
      <section class="viewer-panel-card">
        <p class="eyebrow">World Viewer</p>
        <h2 class="viewer-panel-title">${escapeHtml(state.title)}</h2>
        <p class="viewer-panel-state viewer-panel-state-${state.loadState}">${loadStateLabel(state.loadState)}</p>
        <div class="viewer-panel-meta">
          <p><strong>Source:</strong> ${escapeHtml(state.sourceLabel)}</p>
          <p><strong>Objects:</strong> ${state.objectCount}</p>
          <p><strong>Loaded:</strong> ${state.loadedObjectCount}</p>
          ${
            state.skippedObjectCount > 0
              ? `<p><strong>Skipped:</strong> ${state.skippedObjectCount}</p>`
              : ""
          }
          <p><strong>Updated:</strong> ${escapeHtml(state.updatedAtLabel)}</p>
        </div>
        ${
          state.message
            ? `<p class="viewer-panel-message">${escapeHtml(state.message)}</p>`
            : ""
        }
        <div class="viewer-panel-section">
          <p class="viewer-panel-label">Navigation</p>
          <p class="viewer-controls-legend">Drag: orbit | Right-drag: pan | Wheel: zoom | R: reset</p>
          <button id="viewer-reset-view" class="ui-button builder-button builder-button-block" type="button"${
            state.canResetView ? "" : " disabled"
          }>Reset View</button>
        </div>
        ${renderIssues()}
      </section>
    `;
  };

  const handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("#viewer-reset-view");
    if (!button || button.disabled) {
      return;
    }

    options.onResetView();
  };

  element.hidden = false;
  render();
  element.addEventListener("click", handleClick);

  return {
    dispose: () => {
      element.removeEventListener("click", handleClick);
    },
    setState: (nextState) => {
      state = { ...nextState };
      render();
    }
  };
}
