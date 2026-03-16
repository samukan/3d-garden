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
  onBuildNewV2: () => void;
  onDeleteWorld: (worldId: string) => void;
  onEditWorld: (worldId: string) => void;
  onImportWorldInBuilder: (file: File) => Promise<{ success: boolean; error?: string }>;
  onOpenWorldPackageInViewer: (file: File) => Promise<{ success: boolean; error?: string }>;
  onViewWorld: (worldId: string) => void;
  onOpenWorldJsonInViewer: (input: {
    fileName: string;
    content: string;
  }) => Promise<{ success: boolean; error?: string }>;
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
  let pendingBuilderImportFile: File | null = null;
  let importBuilderInFlight = false;

  const getBuilderImportTypeLabel = (fileName: string): string => {
    const normalized = fileName.trim().toLowerCase();
    if (normalized.endsWith(".sgw")) {
      return "World package (.sgw)";
    }

    if (normalized.endsWith(".json")) {
      return "World JSON (.json)";
    }

    return "World file";
  };

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
    const importModal = pendingBuilderImportFile
      ? `
        <div class="menu-shell-modal-backdrop" role="presentation">
          <div class="menu-shell-modal" role="dialog" aria-modal="true" aria-labelledby="menu-import-builder-title">
            <p id="menu-import-builder-title" class="menu-shell-modal-title">Import Into Builder (v2)</p>
            <p class="menu-shell-modal-copy">Open "${escapeHtml(pendingBuilderImportFile.name)}" as ${escapeHtml(
              getBuilderImportTypeLabel(pendingBuilderImportFile.name).toLowerCase()
            )}?</p>
            <p class="menu-shell-modal-copy">This opens a fresh Build View v2 session with the imported world layout.</p>
            <div class="menu-shell-modal-actions">
              <button id="menu-import-builder-cancel" class="ui-button menu-secondary-button" type="button"${
                importBuilderInFlight ? " disabled" : ""
              }>Cancel</button>
              <button id="menu-import-builder-confirm" class="ui-button menu-secondary-button" type="button"${
                importBuilderInFlight ? " disabled" : ""
              }>${importBuilderInFlight ? "Importing..." : "Import To Builder"}</button>
            </div>
          </div>
        </div>
      `
      : "";

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
            <button id="menu-build-new-v2" class="ui-button menu-secondary-button" type="button">Build New World (v2)</button>
            <button id="menu-import-world-builder" class="ui-button menu-secondary-button" type="button">Import World To Builder (v2)</button>
            <button id="menu-open-json-viewer" class="ui-button menu-secondary-button" type="button">Open JSON In Viewer</button>
            <button id="menu-open-package-viewer" class="ui-button menu-secondary-button" type="button">Open Package In Viewer</button>
            <input id="menu-import-world-input" type="file" accept=".json,.sgw,application/json,application/octet-stream,application/zip" hidden />
            <input id="menu-open-json-input" type="file" accept=".json,application/json" hidden />
            <input id="menu-open-package-input" type="file" accept=".sgw,application/octet-stream,application/zip" hidden />
          </div>
          ${state.notice ? `<p class="menu-notice">${escapeHtml(state.notice)}</p>` : ""}
        </section>
      </div>
      ${importModal}
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

    const buildNewV2Button = target.closest<HTMLButtonElement>("#menu-build-new-v2");
    if (buildNewV2Button) {
      options.onBuildNewV2();
      return;
    }

    const openJsonButton = target.closest<HTMLButtonElement>("#menu-open-json-viewer");
    if (openJsonButton) {
      const input = element.querySelector<HTMLInputElement>("#menu-open-json-input");
      input?.click();
      return;
    }

    const openPackageButton = target.closest<HTMLButtonElement>("#menu-open-package-viewer");
    if (openPackageButton) {
      const input = element.querySelector<HTMLInputElement>("#menu-open-package-input");
      input?.click();
      return;
    }

    const importBuilderButton = target.closest<HTMLButtonElement>("#menu-import-world-builder");
    if (importBuilderButton) {
      const input = element.querySelector<HTMLInputElement>("#menu-import-world-input");
      input?.click();
      return;
    }

    const cancelImportBuilderButton = target.closest<HTMLButtonElement>("#menu-import-builder-cancel");
    if (cancelImportBuilderButton) {
      if (importBuilderInFlight) {
        return;
      }

      pendingBuilderImportFile = null;
      render();
      return;
    }

    const confirmImportBuilderButton = target.closest<HTMLButtonElement>("#menu-import-builder-confirm");
    if (confirmImportBuilderButton) {
      if (importBuilderInFlight || !pendingBuilderImportFile) {
        return;
      }

      const fileToImport = pendingBuilderImportFile;
      importBuilderInFlight = true;
      render();

      void options
        .onImportWorldInBuilder(fileToImport)
        .then((result) => {
          if (result.success) {
            return;
          }

          state = {
            ...state,
            notice: result.error ?? "World could not be imported into builder."
          };
        })
        .catch((error) => {
          state = {
            ...state,
            notice: error instanceof Error ? error.message : "World could not be imported into builder."
          };
        })
        .finally(() => {
          importBuilderInFlight = false;
          pendingBuilderImportFile = null;
          render();
        });
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

  const handleChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files?.[0];
    if (!file) {
      return;
    }

    if (target.id === "menu-open-json-input") {
      void file
        .text()
        .then((content) =>
          options.onOpenWorldJsonInViewer({
            fileName: file.name,
            content
          })
        )
        .then((result) => {
          if (result.success) {
            return;
          }

          state = {
            ...state,
            notice: result.error ?? "World JSON could not be opened."
          };
          render();
        })
        .catch((error) => {
          state = {
            ...state,
            notice: error instanceof Error ? error.message : "World JSON could not be opened."
          };
          render();
        })
        .finally(() => {
          target.value = "";
        });
      return;
    }

    if (target.id === "menu-open-package-input") {
      void options
        .onOpenWorldPackageInViewer(file)
        .then((result) => {
          if (result.success) {
            return;
          }

          state = {
            ...state,
            notice: result.error ?? "World package could not be opened."
          };
          render();
        })
        .catch((error) => {
          state = {
            ...state,
            notice: error instanceof Error ? error.message : "World package could not be opened."
          };
          render();
        })
        .finally(() => {
          target.value = "";
        });
      return;
    }

    if (target.id === "menu-import-world-input") {
      pendingBuilderImportFile = file;
      importBuilderInFlight = false;
      target.value = "";
      render();
    }
  };

  element.hidden = false;
  render();
  element.addEventListener("click", handleClick);
  element.addEventListener("change", handleChange);

  return {
    dispose: () => {
      element.removeEventListener("click", handleClick);
      element.removeEventListener("change", handleChange);
    },
    setState: (nextState) => {
      state = { ...nextState };
      render();
    }
  };
}
