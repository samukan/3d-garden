import type { SavedWorldSummary } from "../builder/builderTypes";
import { escapeHtml } from "../utils/html";

export interface MenuPanelController {
  dispose: () => void;
  setState: (state: MenuPanelState) => void;
}

export interface MenuPanelState {
  notice: string | null;
  worlds: SavedWorldSummary[];
}

export interface CreateMenuPanelOptions {
  onBuildNew: () => void;
  onDeleteWorld: (worldId: string) => void;
  onEditWorld: (worldId: string) => void;
  onViewWorld: (worldId: string) => void;
  state: MenuPanelState;
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function createMenuPanel(element: HTMLElement, options: CreateMenuPanelOptions): MenuPanelController {
  let state = { ...options.state };

  const renderWorldList = (): string => {
    if (state.worlds.length === 0) {
      return `
        <div class="menu-panel-empty">
          <p class="menu-panel-empty-title">No saved worlds yet</p>
          <p class="menu-panel-empty">Build your first world and save it here to unlock read-only viewing and editing.</p>
        </div>
      `;
    }

    return `
      <div class="menu-world-list">
        ${state.worlds
          .map(
            (world) => `
              <article class="menu-world-card">
                <div class="menu-world-header">
                  <div>
                    <h3 class="menu-world-title">${escapeHtml(world.name)}</h3>
                    <p class="menu-world-meta">${world.objectCount} object${world.objectCount === 1 ? "" : "s"} | Updated ${formatDate(world.updatedAt)}</p>
                    <p class="menu-world-meta">Created ${formatDate(world.createdAt)}</p>
                  </div>
                </div>
                <div class="menu-world-actions">
                  <button class="ui-button builder-button builder-button-primary" type="button" data-menu-action="view" data-world-id="${escapeHtml(world.id)}">View</button>
                  <button class="ui-button builder-button" type="button" data-menu-action="edit" data-world-id="${escapeHtml(world.id)}">Edit</button>
                  <button class="ui-button builder-button builder-button-danger" type="button" data-menu-action="delete" data-world-id="${escapeHtml(world.id)}">Delete</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  };

  const render = (): void => {
    element.innerHTML = `
      <div class="menu-panel-shell">
        <section class="menu-panel-list">
          <p class="eyebrow">Saved Worlds</p>
          <h3 class="menu-world-title">View a saved world</h3>
          <p class="menu-panel-copy">Open any saved world in read-only mode, or jump back into the builder to keep editing it.</p>
          ${renderWorldList()}
        </section>
        <section class="menu-panel-intro">
          <p class="eyebrow">Main Menu</p>
          <h2 class="menu-panel-title">Open a world or build a new one.</h2>
          <p class="menu-panel-copy">Saved worlds are the main experience here. Use the builder when you want to start something fresh.</p>
          <div class="menu-primary-actions">
            <button id="menu-build-new" class="ui-button menu-secondary-button" type="button">Build New World</button>
          </div>
          ${state.notice ? `<p class="menu-notice">${escapeHtml(state.notice)}</p>` : ""}
        </section>
      </div>
    `;
  };

  const handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const buildNewButton = target.closest<HTMLButtonElement>("#menu-build-new");
    if (buildNewButton) {
      options.onBuildNew();
      return;
    }

    const actionButton = target.closest<HTMLButtonElement>("[data-menu-action][data-world-id]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.menuAction;
    const worldId = actionButton.dataset.worldId;

    if (!worldId) {
      return;
    }

    if (action === "view") {
      options.onViewWorld(worldId);
      return;
    }

    if (action === "edit") {
      options.onEditWorld(worldId);
      return;
    }

    if (action === "delete") {
      options.onDeleteWorld(worldId);
    }
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
