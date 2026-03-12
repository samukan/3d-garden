import type { SceneBuilderController } from "../builder/sceneBuilder";
import type { BuilderSceneSnapshot } from "../builder/builderTypes";
import type { AssetId } from "../generation/natureKitAssetManifest";
import { escapeHtml } from "../utils/html";

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

const topBarMarkup = `
  <div class="builder-top-bar-main">
    <div class="builder-top-bar-actions builder-top-bar-actions-world">
      <label class="builder-field builder-top-bar-field">
        <span>World name</span>
        <input id="builder-world-name" type="text" maxlength="80" />
      </label>
      <button id="builder-save-world" class="ui-button builder-button builder-button-primary" type="button">Save New</button>
      <button id="builder-save-world-as" class="ui-button builder-button" type="button">Save As</button>
      <button id="builder-view-world" class="ui-button builder-button" type="button">View Saved</button>
      <button id="builder-back-to-menu" class="ui-button builder-button" type="button">Back To Menu</button>
    </div>
    <div class="builder-top-bar-actions builder-top-bar-actions-tools">
      <button id="builder-camera-nav-toggle" class="ui-button builder-button" type="button" aria-pressed="false">Object Edit Mode</button>
      <button id="builder-upload-asset" class="ui-button builder-button builder-button-primary" type="button">Upload Assets (.glb)</button>
      <button id="builder-clear-uploads" class="ui-button builder-button" type="button">Clear uploads</button>
      <input id="builder-upload-asset-input" type="file" accept=".glb,model/gltf-binary" hidden />
    </div>
  </div>
  <div class="builder-top-bar-main">
    <div class="builder-top-bar-actions builder-top-bar-actions-json">
      <button id="builder-export" class="ui-button builder-button" type="button">Export JSON</button>
      <button id="builder-import" class="ui-button builder-button" type="button">Import JSON</button>
      <button id="builder-download-world-json" class="ui-button builder-button" type="button">Download JSON</button>
      <button id="builder-upload-world-json" class="ui-button builder-button" type="button">Upload JSON</button>
      <input id="builder-upload-world-json-input" type="file" accept=".json,application/json" hidden />
    </div>
    <p id="builder-camera-mode-note" class="builder-status builder-camera-mode-note"></p>
  </div>
  <p id="builder-world-status" class="builder-status builder-world-status"></p>
  <label class="builder-textarea-label builder-top-bar-layout-label" for="builder-layout-json">World JSON (manual paste/inspect)</label>
  <textarea id="builder-layout-json" class="builder-textarea builder-top-bar-layout-json" spellcheck="false"></textarea>
`;

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
    <div class="builder-panel-section builder-panel-section-fill">
      <div id="builder-palette"></div>
    </div>
  </div>
  <div id="builder-scene-panel" class="builder-tab-panel" role="tabpanel" aria-labelledby="builder-tab-scene" hidden>
    <div class="builder-panel-section builder-panel-section-fill">
      <div id="builder-scene-objects" class="builder-scene-object-list"></div>
    </div>
  </div>
`;

const rolloutPanelMarkup = `
  <div id="builder-rollout-panel" class="builder-rollout-panel">
    <div id="builder-rollout-content" class="builder-rollout-content"></div>
  </div>
`;

const inspectorPanelMarkup = `
  <div class="builder-panel-header">
    <p class="builder-panel-kicker">Inspector</p>
    <h2>Selected object</h2>
    <p class="builder-panel-copy">Edit the selected object only. World and camera controls are in the top toolbar.</p>
  </div>
  <div class="builder-panel-section builder-panel-section-no-border builder-panel-section-tight">
    <span class="builder-panel-label">Object</span>
    <div id="builder-selection-summary" class="builder-selection-summary"></div>
    <div class="builder-panel-subsection">
      <span class="builder-panel-label">Quick Move</span>
      <p class="builder-control-note">Use object-edit mode to drag safely, or nudge by 0.25 units here.</p>
      <div id="builder-move-controls" class="builder-control-grid builder-control-grid-move">
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="z" data-move-delta="-0.25">Z-</button>
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="y" data-move-delta="0.25">Y+</button>
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="x" data-move-delta="-0.25">X-</button>
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="z" data-move-delta="0.25">Z+</button>
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="y" data-move-delta="-0.25">Y-</button>
        <button class="ui-button builder-button builder-control-button" type="button" data-move-axis="x" data-move-delta="0.25">X+</button>
      </div>
    </div>
    <div class="builder-panel-subsection">
      <span class="builder-panel-label">Rotation</span>
      <div id="builder-rotation-controls" class="builder-action-row builder-action-row-split">
        <button class="ui-button builder-button builder-button-block" type="button" data-rotate-delta="-15">Rotate -15 deg</button>
        <button class="ui-button builder-button builder-button-block" type="button" data-rotate-delta="15">Rotate +15 deg</button>
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
        <span>Rotation Y (deg)</span>
        <input id="builder-rot-y" type="number" step="0.1" />
      </label>
      <label class="builder-field builder-field-full">
        <span>Uniform scale</span>
        <input id="builder-scale" type="number" step="0.1" min="0.1" />
      </label>
    </div>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-duplicate" class="ui-button builder-button builder-button-block" type="button">Duplicate</button>
      <button id="builder-delete" class="ui-button builder-button builder-button-danger builder-button-block" type="button">Delete</button>
    </div>
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

function slugifyWorldName(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "untitled-world";
}

function createWorldDownloadFileName(worldName: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `skill-garden-${slugifyWorldName(worldName)}-${stamp}.json`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const closestEditable = target.closest("input, textarea, [contenteditable='true']");
  return Boolean(closestEditable);
}

export function createBuilderPanel(
  element: HTMLElement,
  sceneBuilder: SceneBuilderController,
  options: CreateBuilderPanelOptions
): BuilderPanelController {
  const topBar = element.querySelector<HTMLElement>("#builder-top-bar");
  const toastHost = element.querySelector<HTMLElement>("#builder-toast-host");
  const libraryPanel = element.querySelector<HTMLElement>("#builder-library-panel");
  const inspectorPanel = element.querySelector<HTMLElement>("#builder-inspector-panel");
  const resizeHandle = element.querySelector<HTMLElement>("#builder-resize-handle");

  if (!topBar || !toastHost || !libraryPanel || !inspectorPanel || !resizeHandle) {
    throw new Error("Builder panel could not find the split layout containers.");
  }

  topBar.innerHTML = topBarMarkup;
  libraryPanel.innerHTML = libraryPanelMarkup;
  inspectorPanel.innerHTML = inspectorPanelMarkup;
  
  // Create and insert rollout panel after library panel
  const rolloutContainer = document.createElement("div");
  rolloutContainer.innerHTML = rolloutPanelMarkup;
  const rolloutPanel = rolloutContainer.firstElementChild as HTMLElement;
  libraryPanel.parentElement?.insertBefore(rolloutPanel, libraryPanel.nextSibling);
  
  element.hidden = false;

  const rolloutContentElement = rolloutPanel.querySelector<HTMLElement>("#builder-rollout-content");
  const assetsTabButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-tab-assets");
  const sceneTabButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-tab-scene");
  const assetsTabPanel = libraryPanel.querySelector<HTMLElement>("#builder-assets-panel");
  const sceneTabPanel = libraryPanel.querySelector<HTMLElement>("#builder-scene-panel");
  const uploadAssetInput = topBar.querySelector<HTMLInputElement>("#builder-upload-asset-input");
  const uploadAssetButton = topBar.querySelector<HTMLButtonElement>("#builder-upload-asset");
  const clearUploadsButton = topBar.querySelector<HTMLButtonElement>("#builder-clear-uploads");
  const cameraNavToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-camera-nav-toggle");
  const cameraModeNoteElement = topBar.querySelector<HTMLElement>("#builder-camera-mode-note");
  const paletteElement = libraryPanel.querySelector<HTMLElement>("#builder-palette");
  const sceneObjectsElement = libraryPanel.querySelector<HTMLElement>("#builder-scene-objects");
  const selectionSummaryElement = inspectorPanel.querySelector<HTMLElement>("#builder-selection-summary");
  const statusElement = inspectorPanel.querySelector<HTMLElement>("#builder-status");
  const worldStatusElement = topBar.querySelector<HTMLElement>("#builder-world-status");
  const worldNameInput = topBar.querySelector<HTMLInputElement>("#builder-world-name");
  const layoutTextarea = topBar.querySelector<HTMLTextAreaElement>("#builder-layout-json");
  const duplicateButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-duplicate");
  const deleteButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-delete");
  const exportButton = topBar.querySelector<HTMLButtonElement>("#builder-export");
  const importButton = topBar.querySelector<HTMLButtonElement>("#builder-import");
  const downloadWorldJsonButton = topBar.querySelector<HTMLButtonElement>("#builder-download-world-json");
  const uploadWorldJsonButton = topBar.querySelector<HTMLButtonElement>("#builder-upload-world-json");
  const uploadWorldJsonInput = topBar.querySelector<HTMLInputElement>("#builder-upload-world-json-input");
  const saveWorldButton = topBar.querySelector<HTMLButtonElement>("#builder-save-world");
  const saveWorldAsButton = topBar.querySelector<HTMLButtonElement>("#builder-save-world-as");
  const viewWorldButton = topBar.querySelector<HTMLButtonElement>("#builder-view-world");
  const backToMenuButton = topBar.querySelector<HTMLButtonElement>("#builder-back-to-menu");
  const posXInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-x");
  const posYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-y");
  const posZInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-z");
  const rotYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-rot-y");
  const scaleInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-scale");
  const moveControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-move-controls");
  const rotationControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-rotation-controls");

  if (
    !rolloutContentElement ||
    !assetsTabButton ||
    !sceneTabButton ||
    !assetsTabPanel ||
    !sceneTabPanel ||
    !uploadAssetInput ||
    !uploadAssetButton ||
    !clearUploadsButton ||
    !cameraNavToggleButton ||
    !cameraModeNoteElement ||
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
    !downloadWorldJsonButton ||
    !uploadWorldJsonButton ||
    !uploadWorldJsonInput ||
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
  let toastTimer: number | null = null;
  let resizeCleanup: (() => void) | null = null;
  let activeLibraryTab: BuilderLibraryTab = "assets";
  let worldState = { ...options.worldState };
  let worldNameDraft = worldState.currentWorldName;
  let cameraNavigationEnabled = sceneBuilder.isCameraNavigationEnabled();

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
    const availableAssetIds = new Set(snapshot.palette.map((item) => item.assetId));
    if (selectedAssetId && availableAssetIds.has(selectedAssetId)) {
      return;
    }

    selectedAssetId = snapshot.palette[0]?.assetId ?? null;
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
    
    // Hide rollout when switching tabs, let render function show it again if needed
    rolloutPanel.classList.remove("is-visible");
  };

  const renderAssetRollout = (snapshot: BuilderSceneSnapshot): void => {
    ensureSelectedAsset(snapshot);

    const selectedItem = snapshot.palette.find((item) => item.assetId === selectedAssetId);

    if (!selectedItem) {
      rolloutContentElement.innerHTML = `
        <p class="builder-rollout-title">No asset available</p>
      `;
      rolloutPanel.classList.remove("is-visible");
      return;
    }

    rolloutContentElement.innerHTML = `
      <p class="builder-rollout-title">${escapeHtml(selectedItem.label)}</p>
      <button id="builder-place-asset" class="ui-button builder-button builder-button-primary builder-button-block" type="button">Add to scene</button>
    `;
    
    const placeAssetButton = rolloutContentElement.querySelector<HTMLButtonElement>("#builder-place-asset");
    if (placeAssetButton) {
      placeAssetButton.disabled = !snapshot.isReady;
      placeAssetButton.addEventListener("click", () => {
        if (!selectedAssetId) {
          return;
        }
        void sceneBuilder.placeAsset(selectedAssetId);
      });
    }
    
    rolloutPanel.classList.add("is-visible");
  };

  const renderObjectRollout = (snapshot: BuilderSceneSnapshot): void => {
    const selectedObject = snapshot.selectedObject;

    if (!selectedObject) {
      rolloutPanel.classList.remove("is-visible");
      return;
    }

    rolloutContentElement.innerHTML = `
      <p class="builder-rollout-title">${escapeHtml(selectedObject.assetLabel)}</p>
      <button id="builder-delete-selected" class="ui-button builder-button builder-button-danger builder-button-block" type="button">Delete</button>
    `;
    
    const deleteButton = rolloutContentElement.querySelector<HTMLButtonElement>("#builder-delete-selected");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        sceneBuilder.deleteSelectedObject();
      });
    }
    
    rolloutPanel.classList.add("is-visible");
  };

  const renderPalette = (snapshot: BuilderSceneSnapshot): void => {
    ensureSelectedAsset(snapshot);
    paletteElement.innerHTML = snapshot.palette
      .map(
        (item) =>
          `<button class="builder-palette-item${item.assetId === selectedAssetId ? " is-selected" : ""}" type="button" data-asset-id="${escapeHtml(item.assetId)}" aria-pressed="${item.assetId === selectedAssetId}">
            ${escapeHtml(item.label)}
          </button>`
      )
      .join("");
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
          <button class="builder-scene-object-item${isSelected ? " is-selected" : ""}" type="button" data-object-id="${escapeHtml(object.id)}">
            ${escapeHtml(assetLabel)}
          </button>
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
          <p class="builder-selection-title">${escapeHtml(selection.assetLabel)}</p>
          <p class="builder-selection-meta">${escapeHtml(selection.id)}</p>
          <p class="builder-selection-meta">${escapeHtml(selection.assetId)}</p>
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

  const renderCameraMode = (): void => {
    cameraNavigationEnabled = sceneBuilder.isCameraNavigationEnabled();
    cameraNavToggleButton.setAttribute("aria-pressed", String(cameraNavigationEnabled));
    cameraNavToggleButton.classList.toggle("builder-button-primary", cameraNavigationEnabled);
    cameraNavToggleButton.textContent = cameraNavigationEnabled ? "Camera Nav Mode" : "Object Edit Mode";
    cameraModeNoteElement.textContent = cameraNavigationEnabled
      ? "Camera navigation is enabled (object dragging is paused). Drag to orbit and use the wheel to zoom."
      : "Camera is locked for object editing. Switch to Camera Nav mode to move the view.";
  };

  const render = (): void => {
    const snapshot = sceneBuilder.getSnapshot();
    renderPalette(snapshot);
    renderSceneObjects(snapshot);
    setActiveLibraryTab(activeLibraryTab);

    // Render appropriate rollout based on active tab
    if (activeLibraryTab === "assets") {
      renderAssetRollout(snapshot);
    } else {
      renderObjectRollout(snapshot);
    }

    renderWorldState();
    renderCameraMode();
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

  const dismissToast = (): void => {
    const toast = toastHost.querySelector<HTMLElement>(".builder-toast");
    if (!toast) {
      return;
    }

    toast.classList.add("is-dismissed");
    window.setTimeout(() => {
      toastHost.innerHTML = "";
    }, 180);
  };

  const showToast = (message: string, variant: "success" | "error" | "info"): void => {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }

    toastHost.innerHTML = `
      <div class="builder-toast builder-toast-${variant}" role="status">
        <span>${escapeHtml(message)}</span>
        <button class="builder-toast-close" type="button" aria-label="Dismiss notification">x</button>
      </div>
    `;

    const closeButton = toastHost.querySelector<HTMLButtonElement>(".builder-toast-close");
    closeButton?.addEventListener("click", () => {
      dismissToast();
    });

    toastTimer = window.setTimeout(() => {
      dismissToast();
    }, 4200);
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

  const handleShortcutKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.repeat) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    const isModifierPressed = event.ctrlKey || event.metaKey;

    if (isModifierPressed && key === "z" && !event.shiftKey) {
      event.preventDefault();
      void sceneBuilder.undo();
      return;
    }

    if ((isModifierPressed && key === "z" && event.shiftKey) || (isModifierPressed && key === "y")) {
      event.preventDefault();
      void sceneBuilder.redo();
      return;
    }

    if (isModifierPressed && key === "d") {
      event.preventDefault();
      void sceneBuilder.duplicateSelectedObject();
      return;
    }

    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      sceneBuilder.deleteSelectedObject();
      return;
    }

    if (key === "escape") {
      event.preventDefault();
      sceneBuilder.selectObjectById(null);
    }
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
    render();
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

    const objectSelectButton = target.closest<HTMLButtonElement>("[data-object-id]");
    if (objectSelectButton) {
      const objectId = objectSelectButton.dataset.objectId;
      if (objectId) {
        sceneBuilder.selectObjectById(objectId);
      }
    }
  });

  uploadAssetButton.addEventListener("click", () => {
    uploadAssetInput.click();
  });

  clearUploadsButton.addEventListener("click", () => {
    const confirmed = window.confirm("Remove all uploaded assets and clear the scene?");
    if (!confirmed) {
      return;
    }

    void sceneBuilder.clearUploads().then((result) => {
      if (!result.success) {
        showToast(result.error ?? "Upload reset failed.", "error");
        return;
      }

      const message =
        result.removedCount > 0
          ? `Cleared ${result.removedCount} uploaded asset${result.removedCount === 1 ? "" : "s"}.`
          : "No uploaded assets to clear.";
      showToast(message, "info");
    });
  });

  cameraNavToggleButton.addEventListener("click", () => {
    const nextEnabled = !sceneBuilder.isCameraNavigationEnabled();
    sceneBuilder.setCameraNavigationEnabled(nextEnabled);
    renderCameraMode();
  });

  uploadAssetInput.addEventListener("change", () => {
    const file = uploadAssetInput.files?.[0];
    if (!file) {
      return;
    }

    void sceneBuilder.uploadAsset(file).then((result) => {
      uploadAssetInput.value = "";
      if (!result.success || !result.assetId) {
        const message = result.error ?? "Asset upload failed.";
        showToast(message, "error");
        return;
      }

      showToast(`Uploaded ${file.name}. Added to the library.`, "success");
      renderPalette(sceneBuilder.getSnapshot());
    });
  });

  const maybeDebugUploadAsset = (): void => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedAsset = params.get("debugUploadAsset");
    if (!requestedAsset) {
      return;
    }

    const basePath = "/assets/nature-kit/Models/GLTF%20format/";
    const assetUrl = requestedAsset.includes("/") ? requestedAsset : `${basePath}${requestedAsset}`;
    const fileName = requestedAsset.split("/").pop() ?? "upload.glb";

    void fetch(assetUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${assetUrl}.`);
        }
        return response.blob();
      })
      .then((blob) => {
        const file = new File([blob], fileName, { type: "model/gltf-binary" });
        return sceneBuilder.uploadAsset(file);
      })
      .then((result) => {
        if (!result.success) {
          showToast(result.error ?? "Asset upload failed.", "error");
          return;
        }
        showToast(`Uploaded ${fileName}.`, "success");
        renderPalette(sceneBuilder.getSnapshot());
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Asset upload failed.";
        showToast(message, "error");
      });
  };

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

  downloadWorldJsonButton.addEventListener("click", () => {
    const layoutJson = sceneBuilder.exportLayout();
    layoutTextarea.value = layoutJson;

    const fileName = createWorldDownloadFileName(worldNameDraft || worldState.currentWorldName || "untitled-world");
    const blob = new Blob([layoutJson], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    showToast(`Downloaded ${fileName}.`, "success");
  });

  uploadWorldJsonButton.addEventListener("click", () => {
    uploadWorldJsonInput.click();
  });

  uploadWorldJsonInput.addEventListener("change", () => {
    const file = uploadWorldJsonInput.files?.[0];
    if (!file) {
      return;
    }

    void file
      .text()
      .then((content) => {
        layoutTextarea.value = content;
        return sceneBuilder.importLayout(content);
      })
      .then((result) => {
        if (!result.success) {
          showToast(result.error ?? "World file could not be imported.", "error");
          return;
        }

        showToast(`Imported ${file.name}.`, "success");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "World file could not be imported.";
        showToast(message, "error");
      })
      .finally(() => {
        uploadWorldJsonInput.value = "";
      });
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
  window.addEventListener("keydown", handleShortcutKeyDown);
  syncResponsiveResizeState();
  setActiveLibraryTab(activeLibraryTab);
  maybeDebugUploadAsset();
  resizeCleanup = () => {
    handlePointerUp();
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("keydown", handleShortcutKeyDown);
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
