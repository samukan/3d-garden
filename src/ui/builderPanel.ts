import type { SceneBuilderController } from "../builder/sceneBuilder";
import type { BuilderSceneSnapshot } from "../builder/builderTypes";
import type { AssetId } from "../generation/natureKitAssetManifest";

export interface BuilderPanelController {
  dispose: () => void;
  setWorldState: (state: BuilderPanelWorldState) => void;
}

export interface BuilderPanelWorldState {
  currentWorldId: string | null;
  currentWorldName: string;
  hasSavedWorld: boolean;
  isDirty: boolean;
  persistenceMessage: string;
}

export interface CreateBuilderPanelOptions {
  onBackToMenu: () => void;
  onSave: (worldName: string) => void;
  onSaveAs: (worldName: string) => void;
  onViewWorld: () => void;
  worldState: BuilderPanelWorldState;
}

const libraryPanelMarkup = `
  <div class="builder-panel-header">
    <p class="builder-panel-kicker">Asset Library</p>
    <h2>Curated assets</h2>
    <p class="builder-panel-copy">Choose an asset, then place it near the current camera target.</p>
  </div>
  <div class="builder-panel-tabs" role="tablist" aria-label="Builder library tabs">
    <button id="builder-tab-assets" class="builder-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="builder-assets-panel" data-builder-tab="assets">Assets</button>
    <button id="builder-tab-scene" class="builder-tab" type="button" role="tab" aria-selected="false" aria-controls="builder-scene-panel" data-builder-tab="scene">Scene Objects</button>
  </div>
  <div id="builder-assets-panel" class="builder-tab-panel is-active" role="tabpanel" aria-labelledby="builder-tab-assets">
    <div class="builder-panel-section builder-panel-section-tight builder-panel-section-no-border">
      <span class="builder-panel-label">Selected Asset</span>
      <div id="builder-asset-selection" class="builder-selection-card"></div>
      <button id="builder-place-asset" class="builder-button builder-button-primary builder-button-block" type="button">Add to scene</button>
    </div>
    <div class="builder-panel-section builder-panel-section-tight">
      <span class="builder-panel-label">Local Upload</span>
      <p class="builder-control-note">Import a .glb file into this browser only.</p>
      <input id="builder-upload-asset-input" type="file" accept=".glb,model/gltf-binary" hidden />
      <button id="builder-upload-asset" class="builder-button builder-button-block" type="button">Upload GLB</button>
    </div>
    <div class="builder-panel-section builder-panel-section-fill">
      <span class="builder-panel-label">Library</span>
      <div id="builder-palette"></div>
    </div>
  </div>
  <div id="builder-scene-panel" class="builder-tab-panel" role="tabpanel" aria-labelledby="builder-tab-scene" hidden>
    <div class="builder-panel-section builder-panel-section-tight builder-panel-section-no-border builder-panel-section-fill">
      <span class="builder-panel-label">Placed Objects</span>
      <div id="builder-scene-objects" class="builder-scene-object-list"></div>
    </div>
  </div>
`;

const inspectorPanelMarkup = `
  <div class="builder-panel-header">
    <p class="builder-panel-kicker">Inspector</p>
    <h2>Selected object</h2>
    <p class="builder-panel-copy">Edit the current object or select one in the scene.</p>
  </div>
  <div class="builder-panel-section builder-panel-section-no-border builder-panel-section-tight">
    <span class="builder-panel-label">World Save</span>
    <label class="builder-field builder-field-full builder-world-name-field">
      <span>World name</span>
      <input id="builder-world-name" type="text" maxlength="80" />
    </label>
    <div class="builder-action-row builder-action-row-split builder-world-actions">
      <button id="builder-save-world" class="builder-button builder-button-primary builder-button-block" type="button">Save</button>
      <button id="builder-save-world-as" class="builder-button builder-button-block" type="button">Save As</button>
    </div>
    <div class="builder-action-row builder-action-row-split builder-world-actions-secondary">
      <button id="builder-view-world" class="builder-button builder-button-block" type="button">View Saved</button>
      <button id="builder-back-to-menu" class="builder-button builder-button-block" type="button">Back To Menu</button>
    </div>
    <p id="builder-world-status" class="builder-status builder-world-status"></p>
  </div>
  <div class="builder-panel-section">
    <span class="builder-panel-label">Object</span>
    <div id="builder-selection-summary" class="builder-selection-summary"></div>
    <div class="builder-panel-subsection">
      <span class="builder-panel-label">Quick Move</span>
      <p class="builder-control-note">Drag in the scene or nudge by 0.25 units.</p>
      <div id="builder-move-controls" class="builder-control-grid builder-control-grid-move">
        <button class="builder-button builder-control-button" type="button" data-move-axis="z" data-move-delta="-0.25">Z-</button>
        <button class="builder-button builder-control-button" type="button" data-move-axis="y" data-move-delta="0.25">Y+</button>
        <button class="builder-button builder-control-button" type="button" data-move-axis="x" data-move-delta="-0.25">X-</button>
        <button class="builder-button builder-control-button" type="button" data-move-axis="z" data-move-delta="0.25">Z+</button>
        <button class="builder-button builder-control-button" type="button" data-move-axis="y" data-move-delta="-0.25">Y-</button>
        <button class="builder-button builder-control-button" type="button" data-move-axis="x" data-move-delta="0.25">X+</button>
      </div>
    </div>
    <div class="builder-panel-subsection">
      <span class="builder-panel-label">Rotation</span>
      <div id="builder-rotation-controls" class="builder-action-row builder-action-row-split">
        <button class="builder-button builder-button-block" type="button" data-rotate-delta="-15">Rotate -15°</button>
        <button class="builder-button builder-button-block" type="button" data-rotate-delta="15">Rotate +15°</button>
      </div>
    </div>
    <div class="builder-field-grid">
      <label class="builder-field">
        <span>Position X</span>
        <input id="builder-pos-x" type="number" step="0.1" />
      </label>
      <label class="builder-field">
        <span>Position Y</span>
        <input id="builder-pos-y" type="number" step="0.1" />
      </label>
      <label class="builder-field">
        <span>Position Z</span>
        <input id="builder-pos-z" type="number" step="0.1" />
      </label>
      <label class="builder-field">
        <span>Rotation Y</span>
        <input id="builder-rot-y" type="number" step="0.1" />
      </label>
      <label class="builder-field builder-field-full">
        <span>Uniform scale</span>
        <input id="builder-scale" type="number" step="0.1" min="0.1" />
      </label>
    </div>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-duplicate" class="builder-button builder-button-block" type="button">Duplicate</button>
      <button id="builder-delete" class="builder-button builder-button-danger builder-button-block" type="button">Delete</button>
    </div>
  </div>
  <div class="builder-panel-section">
    <span class="builder-panel-label">Layout JSON</span>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-export" class="builder-button builder-button-block" type="button">Export</button>
      <button id="builder-import" class="builder-button builder-button-block" type="button">Import</button>
    </div>
    <label class="builder-textarea-label" for="builder-layout-json">Paste or inspect layout JSON</label>
    <textarea id="builder-layout-json" class="builder-textarea" spellcheck="false"></textarea>
  </div>
  <p id="builder-status" class="builder-status"></p>
`;

const DEFAULT_LIBRARY_WIDTH = 320;
const MIN_LIBRARY_WIDTH = 240;
const MAX_LIBRARY_WIDTH = 520;
const MOBILE_BREAKPOINT = 900;
const MOVE_STEP = 0.25;
const ROTATION_STEP = 15;

type BuilderLibraryTab = "assets" | "scene";

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function createBuilderPanel(
  element: HTMLElement,
  sceneBuilder: SceneBuilderController,
  options: CreateBuilderPanelOptions
): BuilderPanelController {
  const libraryPanel = element.querySelector<HTMLElement>("#builder-library-panel");
  const inspectorPanel = element.querySelector<HTMLElement>("#builder-inspector-panel");
  const resizeHandle = element.querySelector<HTMLElement>("#builder-resize-handle");

  if (!libraryPanel || !inspectorPanel || !resizeHandle) {
    throw new Error("Builder panel could not find the split layout containers.");
  }

  libraryPanel.innerHTML = libraryPanelMarkup;
  inspectorPanel.innerHTML = inspectorPanelMarkup;
  element.hidden = false;

  const assetSelectionElement = libraryPanel.querySelector<HTMLElement>("#builder-asset-selection");
  const assetsTabButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-tab-assets");
  const sceneTabButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-tab-scene");
  const assetsTabPanel = libraryPanel.querySelector<HTMLElement>("#builder-assets-panel");
  const sceneTabPanel = libraryPanel.querySelector<HTMLElement>("#builder-scene-panel");
  const placeAssetButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-place-asset");
  const uploadAssetInput = libraryPanel.querySelector<HTMLInputElement>("#builder-upload-asset-input");
  const uploadAssetButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-upload-asset");
  const paletteElement = libraryPanel.querySelector<HTMLElement>("#builder-palette");
  const sceneObjectsElement = libraryPanel.querySelector<HTMLElement>("#builder-scene-objects");
  const selectionSummaryElement = inspectorPanel.querySelector<HTMLElement>("#builder-selection-summary");
  const statusElement = inspectorPanel.querySelector<HTMLElement>("#builder-status");
  const worldStatusElement = inspectorPanel.querySelector<HTMLElement>("#builder-world-status");
  const worldNameInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-world-name");
  const layoutTextarea = inspectorPanel.querySelector<HTMLTextAreaElement>("#builder-layout-json");
  const duplicateButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-duplicate");
  const deleteButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-delete");
  const exportButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-export");
  const importButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-import");
  const saveWorldButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-save-world");
  const saveWorldAsButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-save-world-as");
  const viewWorldButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-view-world");
  const backToMenuButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-back-to-menu");
  const posXInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-x");
  const posYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-y");
  const posZInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-z");
  const rotYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-rot-y");
  const scaleInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-scale");
  const moveControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-move-controls");
  const rotationControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-rotation-controls");

  if (
    !assetSelectionElement ||
    !assetsTabButton ||
    !sceneTabButton ||
    !assetsTabPanel ||
    !sceneTabPanel ||
    !placeAssetButton ||
    !uploadAssetInput ||
    !uploadAssetButton ||
    !paletteElement ||
    !sceneObjectsElement ||
    !selectionSummaryElement ||
    !statusElement ||
    !worldStatusElement ||
    !worldNameInput ||
    !layoutTextarea ||
    !duplicateButton ||
    !deleteButton ||
    !exportButton ||
    !importButton ||
    !saveWorldButton ||
    !saveWorldAsButton ||
    !viewWorldButton ||
    !backToMenuButton ||
    !posXInput ||
    !posYInput ||
    !posZInput ||
    !rotYInput ||
    !scaleInput ||
    !moveControlsElement ||
    !rotationControlsElement
  ) {
    throw new Error("Builder panel could not find the required DOM elements.");
  }

  let selectedAssetId: AssetId | null = null;
  let resizeCleanup: (() => void) | null = null;
  let activeLibraryTab: BuilderLibraryTab = "assets";
  let worldState = { ...options.worldState };
  let worldNameDraft = worldState.currentWorldName;

  const transformInputs = [posXInput, posYInput, posZInput, rotYInput, scaleInput];
  const manipulationButtons = [
    ...moveControlsElement.querySelectorAll<HTMLButtonElement>("button[data-move-axis]"),
    ...rotationControlsElement.querySelectorAll<HTMLButtonElement>("button[data-rotate-delta]")
  ];

  const clampLibraryWidth = (width: number): number => Math.min(MAX_LIBRARY_WIDTH, Math.max(MIN_LIBRARY_WIDTH, width));

  const setLibraryWidth = (width: number): void => {
    element.style.setProperty("--builder-library-width", `${clampLibraryWidth(width)}px`);
  };

  const syncResponsiveResizeState = (): void => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      element.style.removeProperty("--builder-library-width");
      return;
    }

    if (!element.style.getPropertyValue("--builder-library-width")) {
      setLibraryWidth(DEFAULT_LIBRARY_WIDTH);
    }
  };

  const ensureSelectedAsset = (snapshot: BuilderSceneSnapshot): void => {
    const availableAssetIds = new Set(snapshot.palette.flatMap((group) => group.items.map((item) => item.assetId)));
    if (selectedAssetId && availableAssetIds.has(selectedAssetId)) {
      return;
    }

    selectedAssetId = snapshot.palette[0]?.items[0]?.assetId ?? null;
  };

  const setActiveLibraryTab = (tab: BuilderLibraryTab): void => {
    activeLibraryTab = tab;
    assetsTabButton.classList.toggle("is-active", tab === "assets");
    sceneTabButton.classList.toggle("is-active", tab === "scene");
    assetsTabButton.setAttribute("aria-selected", String(tab === "assets"));
    sceneTabButton.setAttribute("aria-selected", String(tab === "scene"));
    assetsTabPanel.hidden = tab !== "assets";
    sceneTabPanel.hidden = tab !== "scene";
    assetsTabPanel.classList.toggle("is-active", tab === "assets");
    sceneTabPanel.classList.toggle("is-active", tab === "scene");
  };

  const renderSelectedAsset = (snapshot: BuilderSceneSnapshot): void => {
    ensureSelectedAsset(snapshot);

    const selectedItem = snapshot.palette
      .flatMap((group) => group.items)
      .find((item) => item.assetId === selectedAssetId);

    if (!selectedItem) {
      assetSelectionElement.innerHTML = `
        <p class="builder-selection-title">No asset available</p>
        <p class="builder-selection-meta">The asset library is empty.</p>
      `;
      placeAssetButton.disabled = true;
      return;
    }

    assetSelectionElement.innerHTML = `
      <p class="builder-selection-title">${selectedItem.label}</p>
      <p class="builder-selection-meta">${selectedItem.assetId}</p>
    `;
    placeAssetButton.disabled = !snapshot.isReady;
  };

  const renderPalette = (snapshot: BuilderSceneSnapshot): void => {
    ensureSelectedAsset(snapshot);
    paletteElement.innerHTML = snapshot.palette
      .map(
        (group) => `
          <section class="builder-palette-group">
            <h3>${group.label}</h3>
            <div class="builder-palette-list">
              ${group.items
                .map(
                  (item) =>
                    `<button class="builder-palette-item${item.assetId === selectedAssetId ? " is-selected" : ""}" type="button" data-asset-id="${item.assetId}" aria-pressed="${item.assetId === selectedAssetId}">
                      <span class="builder-palette-item-label">${item.label}</span>
                      <span class="builder-palette-item-meta">${item.assetId}</span>
                    </button>`
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");

    renderSelectedAsset(snapshot);
  };

  const renderSceneObjects = (snapshot: BuilderSceneSnapshot): void => {
    if (snapshot.objects.length === 0) {
      sceneObjectsElement.innerHTML = `
        <div class="builder-empty-state">
          <p class="builder-selection-title">No placed objects</p>
          <p class="builder-selection-meta">Add an asset from the Assets tab to start building the scene.</p>
        </div>
      `;
      return;
    }

    sceneObjectsElement.innerHTML = snapshot.objects
      .map((object) => {
        const assetLabel = object.assetLabel;
        const isSelected = object.id === snapshot.selectedObjectId;

        return `
          <div class="builder-scene-object-row${isSelected ? " is-selected" : ""}">
            <button class="builder-scene-object-select" type="button" data-object-id="${object.id}">
              <span class="builder-scene-object-title">${assetLabel}</span>
              <span class="builder-scene-object-meta">${object.id}</span>
            </button>
            <button class="builder-scene-object-delete" type="button" data-delete-object-id="${object.id}" aria-label="Delete ${assetLabel}">Delete</button>
          </div>
        `;
      })
      .join("");
  };

  const renderSelection = (snapshot: BuilderSceneSnapshot): void => {
    const selection = snapshot.selectedObject;
    const hasSelection = Boolean(selection);

    if (!selection) {
      selectionSummaryElement.innerHTML = `
        <div class="builder-empty-state">
          <p class="builder-selection-title">No object selected</p>
          <p class="builder-selection-meta">Select an object in the scene to edit it here.</p>
          <p class="builder-selection-meta">Placed objects: ${snapshot.objects.length}</p>
        </div>
      `;
    } else {
      selectionSummaryElement.innerHTML = `
        <div class="builder-selection-card">
          <p class="builder-selection-title">${selection.assetLabel}</p>
          <p class="builder-selection-meta">${selection.id}</p>
          <p class="builder-selection-meta">${selection.assetId}</p>
        </div>
      `;
    }

    for (const input of transformInputs) {
      input.disabled = !hasSelection;
    }

    duplicateButton.disabled = !hasSelection;
    deleteButton.disabled = !hasSelection;

    for (const button of manipulationButtons) {
      button.disabled = !hasSelection;
    }

    posXInput.value = selection ? formatNumber(selection.position.x) : "";
    posYInput.value = selection ? formatNumber(selection.position.y) : "";
    posZInput.value = selection ? formatNumber(selection.position.z) : "";
    rotYInput.value = selection ? formatNumber(selection.rotationY) : "";
    scaleInput.value = selection ? formatNumber(selection.scale) : "";
  };

  const renderStatus = (snapshot: BuilderSceneSnapshot): void => {
    statusElement.textContent = snapshot.statusMessage;
  };

  const renderWorldState = (): void => {
    worldNameInput.value = worldNameDraft;
    const saveButtonLabel = worldState.hasSavedWorld ? "Save Changes" : "Save New";
    saveWorldButton.textContent = saveButtonLabel;
    viewWorldButton.disabled = !worldState.hasSavedWorld;
    const dirtyLabel = worldState.isDirty ? " Unsaved changes." : worldState.hasSavedWorld ? " Saved version is current." : "";
    worldStatusElement.textContent = `${worldState.persistenceMessage}${dirtyLabel}`.trim();
  };

  const render = (): void => {
    const snapshot = sceneBuilder.getSnapshot();
    renderPalette(snapshot);
    renderSceneObjects(snapshot);
    setActiveLibraryTab(activeLibraryTab);

    renderWorldState();
    renderSelection(snapshot);
    renderStatus(snapshot);
  };

  const nudgeSelectedObject = (axis: "x" | "y" | "z", delta: number): void => {
    const selection = sceneBuilder.getSnapshot().selectedObject;
    if (!selection) {
      return;
    }

    const nextValue = Number((selection.position[axis] + delta).toFixed(3));
    sceneBuilder.updateSelectedTransform({
      position: {
        [axis]: nextValue
      }
    });
  };

  const rotateSelectedObject = (delta: number): void => {
    const selection = sceneBuilder.getSnapshot().selectedObject;
    if (!selection) {
      return;
    }

    sceneBuilder.updateSelectedTransform({
      rotationY: Number((selection.rotationY + delta).toFixed(3))
    });
  };

  const applyNumericChange = (
    input: HTMLInputElement,
    callback: (value: number) => void
  ): void => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      render();
      return;
    }

    callback(value);
  };

  paletteElement.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof HTMLElement ? target.closest<HTMLButtonElement>("[data-asset-id]") : null;
    if (!button) {
      return;
    }

    const assetId = button.dataset.assetId;
    if (!assetId) {
      return;
    }

    selectedAssetId = assetId;
    renderPalette(sceneBuilder.getSnapshot());
  });

  libraryPanel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tabButton = target.closest<HTMLButtonElement>("[data-builder-tab]");
    if (tabButton) {
      const nextTab = tabButton.dataset.builderTab;
      if (nextTab === "assets" || nextTab === "scene") {
        setActiveLibraryTab(nextTab);
      }
      return;
    }

    const deleteObjectButton = target.closest<HTMLButtonElement>("[data-delete-object-id]");
    if (deleteObjectButton) {
      const objectId = deleteObjectButton.dataset.deleteObjectId;
      if (objectId) {
        sceneBuilder.deleteObjectById(objectId);
      }
      return;
    }

    const objectSelectButton = target.closest<HTMLButtonElement>("[data-object-id]");
    if (objectSelectButton) {
      const objectId = objectSelectButton.dataset.objectId;
      if (objectId) {
        sceneBuilder.selectObjectById(objectId);
      }
    }
  });

  placeAssetButton.addEventListener("click", () => {
    if (!selectedAssetId) {
      return;
    }

    void sceneBuilder.placeAsset(selectedAssetId);
  });

  uploadAssetButton.addEventListener("click", () => {
    uploadAssetInput.click();
  });

  uploadAssetInput.addEventListener("change", () => {
    const file = uploadAssetInput.files?.[0];
    if (!file) {
      return;
    }

    void sceneBuilder.uploadAsset(file).then((result) => {
      uploadAssetInput.value = "";
      if (!result.success || !result.assetId) {
        return;
      }

      selectedAssetId = result.assetId;
      renderPalette(sceneBuilder.getSnapshot());
    });
  });

  posXInput.addEventListener("change", () => {
    applyNumericChange(posXInput, (value) => {
      sceneBuilder.updateSelectedTransform({ position: { x: value } });
    });
  });

  posYInput.addEventListener("change", () => {
    applyNumericChange(posYInput, (value) => {
      sceneBuilder.updateSelectedTransform({ position: { y: value } });
    });
  });

  posZInput.addEventListener("change", () => {
    applyNumericChange(posZInput, (value) => {
      sceneBuilder.updateSelectedTransform({ position: { z: value } });
    });
  });

  rotYInput.addEventListener("change", () => {
    applyNumericChange(rotYInput, (value) => {
      sceneBuilder.updateSelectedTransform({ rotationY: value });
    });
  });

  scaleInput.addEventListener("change", () => {
    applyNumericChange(scaleInput, (value) => {
      sceneBuilder.updateSelectedTransform({ scale: value });
    });
  });

  moveControlsElement.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof HTMLElement ? target.closest<HTMLButtonElement>("[data-move-axis]") : null;
    if (!button) {
      return;
    }

    const axis = button.dataset.moveAxis;
    const delta = Number(button.dataset.moveDelta ?? MOVE_STEP);
    if ((axis !== "x" && axis !== "y" && axis !== "z") || !Number.isFinite(delta)) {
      return;
    }

    nudgeSelectedObject(axis, delta);
  });

  rotationControlsElement.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof HTMLElement ? target.closest<HTMLButtonElement>("[data-rotate-delta]") : null;
    if (!button) {
      return;
    }

    const delta = Number(button.dataset.rotateDelta ?? ROTATION_STEP);
    if (!Number.isFinite(delta)) {
      return;
    }

    rotateSelectedObject(delta);
  });

  duplicateButton.addEventListener("click", () => {
    void sceneBuilder.duplicateSelectedObject();
  });

  deleteButton.addEventListener("click", () => {
    sceneBuilder.deleteSelectedObject();
  });

  exportButton.addEventListener("click", () => {
    layoutTextarea.value = sceneBuilder.exportLayout();
  });

  importButton.addEventListener("click", () => {
    void sceneBuilder.importLayout(layoutTextarea.value);
  });

  saveWorldButton.addEventListener("click", () => {
    options.onSave(worldNameDraft);
  });

  saveWorldAsButton.addEventListener("click", () => {
    options.onSaveAs(worldNameDraft);
  });

  worldNameInput.addEventListener("input", () => {
    worldNameDraft = worldNameInput.value;
  });

  viewWorldButton.addEventListener("click", () => {
    if (worldState.hasSavedWorld) {
      options.onViewWorld();
    }
  });

  backToMenuButton.addEventListener("click", () => {
    options.onBackToMenu();
  });

  const unsubscribe = sceneBuilder.subscribe(() => {
    render();
  });

  const handlePointerMove = (event: PointerEvent): void => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      return;
    }

    const nextWidth = event.clientX - element.getBoundingClientRect().left;
    setLibraryWidth(nextWidth);
  };

  const handlePointerUp = (): void => {
    resizeHandle.classList.remove("is-dragging");
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  resizeHandle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      return;
    }

    event.preventDefault();
    resizeHandle.classList.add("is-dragging");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  });

  const handleResize = (): void => {
    syncResponsiveResizeState();
  };

  window.addEventListener("resize", handleResize);
  syncResponsiveResizeState();
  setActiveLibraryTab(activeLibraryTab);
  resizeCleanup = () => {
    handlePointerUp();
    window.removeEventListener("resize", handleResize);
  };

  render();

  return {
    dispose: () => {
      unsubscribe();
      resizeCleanup?.();
    },
    setWorldState: (nextState) => {
      const shouldResetDraft = nextState.currentWorldName !== worldState.currentWorldName || !worldNameDraft.trim();
      worldState = { ...nextState };
      if (shouldResetDraft) {
        worldNameDraft = nextState.currentWorldName;
      }
      renderWorldState();
    }
  };
}