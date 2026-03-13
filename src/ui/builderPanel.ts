import type { BuilderTransformMode, SceneBuilderController } from "../builder/sceneBuilder";
import type { BuilderPaletteItem, BuilderSceneSnapshot } from "../builder/builderTypes";
import { DEFAULT_UPLOADED_ASSET_CATEGORY, type AssetId } from "../generation/natureKitAssetManifest";
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
        <span class="builder-visually-hidden">World name</span>
        <input id="builder-world-name" type="text" maxlength="80" placeholder="World name" aria-label="World name" />
      </label>
      <button id="builder-save-world" class="ui-button builder-button builder-button-primary" type="button">Save New</button>
      <button id="builder-save-world-as" class="ui-button builder-button" type="button">Save As</button>
      <button id="builder-view-world" class="ui-button builder-button" type="button">View Saved</button>
      <button id="builder-back-to-menu" class="ui-button builder-button" type="button">Back To Menu</button>
    </div>
    <div class="builder-top-bar-actions builder-top-bar-actions-tools">
      <button id="builder-camera-nav-toggle" class="ui-button builder-button builder-button-camera" type="button" aria-pressed="false">Object Edit Mode</button>
      <div class="builder-transform-mode-group" role="group" aria-label="Transform mode">
        <button id="builder-transform-mode-move" class="ui-button builder-button builder-transform-mode-button" type="button" data-transform-mode="move" aria-pressed="true">Move</button>
        <button id="builder-transform-mode-rotate" class="ui-button builder-button builder-transform-mode-button" type="button" data-transform-mode="rotate" aria-pressed="false">Rotate</button>
        <button id="builder-transform-mode-scale" class="ui-button builder-button builder-transform-mode-button" type="button" data-transform-mode="scale" aria-pressed="false">Scale</button>
      </div>
      <button id="builder-advanced-tools-toggle" class="ui-button builder-button" type="button" aria-expanded="false" aria-controls="builder-advanced-tools-panel">Advanced Tools</button>
      <p id="builder-world-status" class="builder-status builder-world-status" aria-live="polite"></p>
    </div>
  </div>
  <div id="builder-advanced-tools-panel" class="builder-advanced-tools-panel" hidden>
    <div class="builder-advanced-tools-header">
      <p class="builder-panel-kicker">Advanced Tools</p>
      <button id="builder-advanced-tools-close" class="ui-button builder-button" type="button">Close</button>
    </div>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-export" class="ui-button builder-button builder-button-block" type="button">Export JSON</button>
      <button id="builder-import" class="ui-button builder-button builder-button-block" type="button">Import JSON</button>
    </div>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-download-world-package" class="ui-button builder-button builder-button-block" type="button">Download Package</button>
      <button id="builder-upload-world-package" class="ui-button builder-button builder-button-block" type="button">Upload Package</button>
      <input id="builder-upload-world-package-input" type="file" accept=".sgw,application/octet-stream,application/zip" hidden />
    </div>
    <div class="builder-action-row builder-action-row-split">
      <button id="builder-download-world-json" class="ui-button builder-button builder-button-block" type="button">Download JSON</button>
      <button id="builder-upload-world-json" class="ui-button builder-button builder-button-block" type="button">Upload JSON</button>
      <input id="builder-upload-world-json-input" type="file" accept=".json,application/json" hidden />
    </div>
    <label class="builder-textarea-label builder-advanced-tools-label" for="builder-layout-json">Manual JSON (advanced)</label>
    <textarea id="builder-layout-json" class="builder-textarea builder-advanced-tools-json" spellcheck="false"></textarea>
  </div>
`;

const libraryPanelMarkup = `
  <div class="builder-panel-header">
    <p class="builder-panel-kicker">Asset Library</p>
    <h2>Curated assets</h2>
    <p class="builder-panel-copy">Choose an asset, then place it near the current camera target.</p>
  </div>
  <div class="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-library-tools">
    <span class="builder-panel-label">Library Tools</span>
    <div class="builder-action-row builder-action-row-upload-tools">
      <button id="builder-upload-asset" class="ui-button builder-button builder-button-block" type="button">Upload Assets (.glb)</button>
      <button id="builder-remove-upload" class="ui-button builder-button builder-button-block" type="button">Remove selected upload</button>
      <button id="builder-clear-uploads" class="ui-button builder-button builder-button-block" type="button">Clear uploads</button>
      <input id="builder-upload-asset-input" type="file" accept=".glb,model/gltf-binary" multiple hidden />
    </div>
    <div class="builder-library-upload-controls">
      <label class="builder-field builder-library-sort-field" for="builder-upload-sort">
        <span>Sort uploads</span>
        <select id="builder-upload-sort" class="builder-select">
          <option value="alpha">A-Z</option>
          <option value="date-uploaded">Date uploaded</option>
        </select>
      </label>
      <button id="builder-rename-upload-category" class="ui-button builder-button builder-button-block" type="button">Rename category</button>
    </div>
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
      <p class="builder-control-note">Use top-bar transform modes (1/2/3) for gizmos, or nudge by 0.25 units here.</p>
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
type UploadedAssetSortMode = "alpha" | "date-uploaded";

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function getUploadedAssetTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
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

  const closestEditable = target.closest("input, textarea, select, [contenteditable='true']");
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

  element.querySelector("#builder-toggle-library-panel")?.remove();
  element.querySelector("#builder-toggle-inspector-panel")?.remove();

  const libraryPanelToggleButton = document.createElement("button");
  libraryPanelToggleButton.id = "builder-toggle-library-panel";
  libraryPanelToggleButton.className =
    "ui-button builder-button builder-side-toggle builder-side-toggle-library";
  libraryPanelToggleButton.type = "button";
  libraryPanelToggleButton.setAttribute("aria-controls", "builder-library-panel");
  libraryPanelToggleButton.setAttribute("aria-expanded", "true");

  const inspectorPanelToggleButton = document.createElement("button");
  inspectorPanelToggleButton.id = "builder-toggle-inspector-panel";
  inspectorPanelToggleButton.className =
    "ui-button builder-button builder-side-toggle builder-side-toggle-inspector";
  inspectorPanelToggleButton.type = "button";
  inspectorPanelToggleButton.setAttribute("aria-controls", "builder-inspector-panel");
  inspectorPanelToggleButton.setAttribute("aria-expanded", "true");

  element.append(libraryPanelToggleButton, inspectorPanelToggleButton);

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
  const uploadAssetInput = libraryPanel.querySelector<HTMLInputElement>("#builder-upload-asset-input");
  const uploadAssetButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-upload-asset");
  const removeUploadButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-remove-upload");
  const clearUploadsButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-clear-uploads");
  const uploadSortSelect = libraryPanel.querySelector<HTMLSelectElement>("#builder-upload-sort");
  const renameCategoryButton = libraryPanel.querySelector<HTMLButtonElement>("#builder-rename-upload-category");
  const cameraNavToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-camera-nav-toggle");
  const transformModeButtons = Array.from(
    topBar.querySelectorAll<HTMLButtonElement>("[data-transform-mode]")
  );
  const advancedToolsToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-advanced-tools-toggle");
  const advancedToolsPanel = topBar.querySelector<HTMLElement>("#builder-advanced-tools-panel");
  const advancedToolsCloseButton = topBar.querySelector<HTMLButtonElement>("#builder-advanced-tools-close");
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
  const downloadWorldPackageButton = topBar.querySelector<HTMLButtonElement>("#builder-download-world-package");
  const uploadWorldPackageButton = topBar.querySelector<HTMLButtonElement>("#builder-upload-world-package");
  const uploadWorldPackageInput = topBar.querySelector<HTMLInputElement>("#builder-upload-world-package-input");
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
    !removeUploadButton ||
    !clearUploadsButton ||
    !uploadSortSelect ||
    !renameCategoryButton ||
    !cameraNavToggleButton ||
    transformModeButtons.length !== 3 ||
    !advancedToolsToggleButton ||
    !advancedToolsPanel ||
    !advancedToolsCloseButton ||
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
    !downloadWorldPackageButton ||
    !uploadWorldPackageButton ||
    !uploadWorldPackageInput ||
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
  let transformMode: BuilderTransformMode = sceneBuilder.getTransformMode();
  let advancedToolsOpen = false;
  let assetRolloutDismissed = false;
  let libraryPanelCollapsed = false;
  let inspectorPanelCollapsed = false;
  let uploadedAssetSortMode: UploadedAssetSortMode = "alpha";

  const transformInputs = [posXInput, posYInput, posZInput, rotYInput, scaleInput];
  const manipulationButtons = [
    ...moveControlsElement.querySelectorAll<HTMLButtonElement>("button[data-move-axis]"),
    ...rotationControlsElement.querySelectorAll<HTMLButtonElement>("button[data-rotate-delta]")
  ];

  const clampLibraryWidth = (width: number): number => Math.min(MAX_LIBRARY_WIDTH, Math.max(MIN_LIBRARY_WIDTH, width));

  const setLibraryWidth = (width: number): void => {
    element.style.setProperty("--builder-library-width", `${clampLibraryWidth(width)}px`);
  };

  const renderSidePanelToggles = (): void => {
    element.classList.toggle("is-library-collapsed", libraryPanelCollapsed);
    element.classList.toggle("is-inspector-collapsed", inspectorPanelCollapsed);

    libraryPanelToggleButton.textContent = libraryPanelCollapsed ? ">" : "<";
    libraryPanelToggleButton.setAttribute("aria-expanded", String(!libraryPanelCollapsed));
    libraryPanelToggleButton.setAttribute(
      "aria-label",
      libraryPanelCollapsed ? "Show asset library panel" : "Hide asset library panel"
    );
    libraryPanelToggleButton.title = libraryPanelCollapsed ? "Show asset library panel" : "Hide asset library panel";

    inspectorPanelToggleButton.textContent = inspectorPanelCollapsed ? "<" : ">";
    inspectorPanelToggleButton.setAttribute("aria-expanded", String(!inspectorPanelCollapsed));
    inspectorPanelToggleButton.setAttribute(
      "aria-label",
      inspectorPanelCollapsed ? "Show inspector panel" : "Hide inspector panel"
    );
    inspectorPanelToggleButton.title = inspectorPanelCollapsed ? "Show inspector panel" : "Hide inspector panel";

    if (libraryPanelCollapsed) {
      assetRolloutDismissed = true;
      rolloutPanel.classList.remove("is-visible");
    }
  };

  const syncResponsiveResizeState = (): void => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      element.style.removeProperty("--builder-library-width");
      if (libraryPanelCollapsed || inspectorPanelCollapsed) {
        libraryPanelCollapsed = false;
        inspectorPanelCollapsed = false;
        renderSidePanelToggles();
      }
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

    const previousSelectedAssetId = selectedAssetId;
    selectedAssetId = snapshot.palette[0]?.assetId ?? null;
    if (selectedAssetId !== previousSelectedAssetId) {
      assetRolloutDismissed = false;
    }
  };

  const getSelectedPaletteItem = (snapshot: BuilderSceneSnapshot): BuilderPaletteItem | null => {
    ensureSelectedAsset(snapshot);
    if (!selectedAssetId) {
      return null;
    }

    return snapshot.palette.find((item) => item.assetId === selectedAssetId) ?? null;
  };

  const sortUploadedItems = (items: BuilderPaletteItem[]): BuilderPaletteItem[] => {
    if (uploadedAssetSortMode === "date-uploaded") {
      return items
        .slice()
        .sort(
          (left, right) =>
            getUploadedAssetTimestamp(right.uploadedAt) - getUploadedAssetTimestamp(left.uploadedAt) ||
            left.label.localeCompare(right.label)
        );
    }

    return items.slice().sort((left, right) => left.label.localeCompare(right.label));
  };

  const renderPaletteButtons = (items: BuilderPaletteItem[]): string =>
    items
      .map(
        (item) =>
          `<button class="builder-palette-item${item.assetId === selectedAssetId ? " is-selected" : ""}" type="button" data-asset-id="${escapeHtml(item.assetId)}" aria-pressed="${item.assetId === selectedAssetId}">
            ${escapeHtml(item.label)}
          </button>`
      )
      .join("");

  const renderLibraryTools = (snapshot: BuilderSceneSnapshot): void => {
    const selectedItem = getSelectedPaletteItem(snapshot);
    const selectedUploadedAssetLabel = selectedItem?.sourceType === "uploaded" ? selectedItem.label : null;
    const selectedCategory = selectedItem?.sourceType === "uploaded" ? selectedItem.uploadedCategory : null;
    removeUploadButton.disabled = !selectedUploadedAssetLabel;
    removeUploadButton.title = selectedUploadedAssetLabel
      ? `Remove uploaded asset "${selectedUploadedAssetLabel}" only.`
      : "Select an uploaded asset to remove it.";
    renameCategoryButton.disabled = !selectedCategory;
    renameCategoryButton.title = selectedCategory
      ? `Rename category "${selectedCategory}".`
      : "Select an uploaded asset to rename its category.";
    uploadSortSelect.value = uploadedAssetSortMode;
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

  const setAdvancedToolsOpen = (open: boolean): void => {
    advancedToolsOpen = open;
    advancedToolsPanel.hidden = !open;
    advancedToolsToggleButton.setAttribute("aria-expanded", String(open));
    topBar.classList.toggle("is-advanced-tools-open", open);
  };

  const renderAssetRollout = (snapshot: BuilderSceneSnapshot): void => {
    ensureSelectedAsset(snapshot);

    if (libraryPanelCollapsed) {
      rolloutPanel.classList.remove("is-visible");
      return;
    }

    const selectedItem = getSelectedPaletteItem(snapshot);

    if (!selectedItem) {
      rolloutContentElement.innerHTML = `
        <p class="builder-rollout-title">No asset available</p>
      `;
      rolloutPanel.classList.remove("is-visible");
      return;
    }

    if (assetRolloutDismissed) {
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
        assetRolloutDismissed = true;
        rolloutPanel.classList.remove("is-visible");
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
    const builtInItems = snapshot.palette
      .filter((item) => item.sourceType === "built-in")
      .sort((left, right) => left.label.localeCompare(right.label));
    const uploadedItems = sortUploadedItems(snapshot.palette.filter((item) => item.sourceType === "uploaded"));
    const uploadedByCategory = new Map<string, BuilderPaletteItem[]>();

    for (const item of uploadedItems) {
      const category = item.uploadedCategory ?? DEFAULT_UPLOADED_ASSET_CATEGORY;
      const group = uploadedByCategory.get(category) ?? [];
      group.push(item);
      uploadedByCategory.set(category, group);
    }

    const sections: string[] = [];

    if (builtInItems.length > 0) {
      sections.push(`
        <div class="builder-palette-group" data-palette-group="built-in">
          <p class="builder-palette-group-title">Built-in Assets</p>
          <div class="builder-palette-group-items">
            ${renderPaletteButtons(builtInItems)}
          </div>
        </div>
      `);
    }

    if (uploadedByCategory.size > 0) {
      const categories = Array.from(uploadedByCategory.entries()).sort((left, right) => left[0].localeCompare(right[0]));
      sections.push(`
        <div class="builder-palette-group" data-palette-group="uploaded">
          <p class="builder-palette-group-title">Uploaded Assets</p>
        </div>
      `);
      for (const [category, items] of categories) {
        sections.push(`
          <div class="builder-palette-group builder-palette-group-uploaded" data-upload-category="${escapeHtml(category)}">
            <p class="builder-palette-group-subtitle">${escapeHtml(category)} (${items.length})</p>
            <div class="builder-palette-group-items">
              ${renderPaletteButtons(items)}
            </div>
          </div>
        `);
      }
    }

    if (sections.length === 0) {
      sections.push(`
        <div class="builder-empty-state">
          <p class="builder-selection-title">No assets available</p>
        </div>
      `);
    }

    paletteElement.innerHTML = sections.join("");
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
    const compactState = worldState.isDirty ? "Unsaved" : worldState.hasSavedWorld ? "Saved" : "New";
    const verboseState = `${worldState.persistenceMessage}${worldState.isDirty ? " Unsaved changes." : ""}`.trim();
    worldStatusElement.textContent = compactState;
    worldStatusElement.title = verboseState;
  };

  const renderCameraMode = (): void => {
    cameraNavigationEnabled = sceneBuilder.isCameraNavigationEnabled();
    cameraNavToggleButton.setAttribute("aria-pressed", String(cameraNavigationEnabled));
    cameraNavToggleButton.classList.toggle("builder-button-primary", cameraNavigationEnabled);
    cameraNavToggleButton.textContent = cameraNavigationEnabled ? "Camera Nav Mode" : "Object Edit Mode";
    cameraNavToggleButton.title = cameraNavigationEnabled
      ? "Camera navigation is enabled. Drag to orbit and use the wheel to zoom. Shortcut: C."
      : "Object edit mode is enabled. Camera navigation is locked. Shortcut: C.";
  };

  const renderTransformMode = (): void => {
    transformMode = sceneBuilder.getTransformMode();
    for (const button of transformModeButtons) {
      const buttonMode = button.dataset.transformMode;
      const isActive = buttonMode === transformMode;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("builder-button-primary", isActive);
      button.classList.toggle("is-active", isActive);
    }
  };

  const setTransformMode = (mode: BuilderTransformMode): void => {
    sceneBuilder.setTransformMode(mode);
    renderTransformMode();
  };

  const toggleCameraNavigationMode = (): void => {
    const nextEnabled = !sceneBuilder.isCameraNavigationEnabled();
    sceneBuilder.setCameraNavigationEnabled(nextEnabled);
    renderCameraMode();
  };

  const render = (): void => {
    const snapshot = sceneBuilder.getSnapshot();
    renderPalette(snapshot);
    renderLibraryTools(snapshot);
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
    renderTransformMode();
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

    const key = event.key.toLowerCase();
    if (isEditableTarget(event.target)) {
      return;
    }

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

    if (key === "c") {
      event.preventDefault();
      toggleCameraNavigationMode();
      return;
    }

    if (key === "1") {
      event.preventDefault();
      setTransformMode("move");
      return;
    }

    if (key === "2") {
      event.preventDefault();
      setTransformMode("rotate");
      return;
    }

    if (key === "3") {
      event.preventDefault();
      setTransformMode("scale");
      return;
    }

    if (key === "escape") {
      event.preventDefault();
      sceneBuilder.selectObjectById(null);
    }
  };

  libraryPanelToggleButton.addEventListener("click", () => {
    libraryPanelCollapsed = !libraryPanelCollapsed;
    renderSidePanelToggles();
  });

  inspectorPanelToggleButton.addEventListener("click", () => {
    inspectorPanelCollapsed = !inspectorPanelCollapsed;
    renderSidePanelToggles();
  });

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
    assetRolloutDismissed = false;
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

  uploadSortSelect.addEventListener("change", () => {
    const nextSortMode = uploadSortSelect.value === "date-uploaded" ? "date-uploaded" : "alpha";
    if (uploadedAssetSortMode === nextSortMode) {
      return;
    }

    uploadedAssetSortMode = nextSortMode;
    render();
  });

  renameCategoryButton.addEventListener("click", () => {
    const snapshot = sceneBuilder.getSnapshot();
    const selectedItem = getSelectedPaletteItem(snapshot);
    if (!selectedItem || selectedItem.sourceType !== "uploaded") {
      showToast("Select an uploaded asset to rename its category.", "info");
      return;
    }

    const nextCategoryInput = window.prompt(
      "Rename uploaded category:",
      selectedItem.uploadedCategory ?? DEFAULT_UPLOADED_ASSET_CATEGORY
    );
    if (nextCategoryInput === null) {
      return;
    }

    void sceneBuilder.renameUploadedAssetCategory(selectedItem.assetId, nextCategoryInput).then((result) => {
      if (!result.success) {
        showToast(result.error ?? "Category rename failed.", "error");
        return;
      }

      showToast("Category updated.", "success");
      render();
    });
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

  removeUploadButton.addEventListener("click", () => {
    const snapshot = sceneBuilder.getSnapshot();
    const selectedItem = getSelectedPaletteItem(snapshot);
    if (!selectedItem || selectedItem.sourceType !== "uploaded") {
      showToast("Select an uploaded asset to remove it.", "info");
      return;
    }

    const confirmed = window.confirm(`Remove uploaded asset "${selectedItem.label}"?`);
    if (!confirmed) {
      return;
    }

    void sceneBuilder.removeUploadedAsset(selectedItem.assetId).then((result) => {
      if (!result.success) {
        showToast(result.error ?? "Uploaded asset removal failed.", "error");
        return;
      }

      const message =
        result.removedObjectCount > 0
          ? `Removed "${selectedItem.label}" and ${result.removedObjectCount} placed instance${result.removedObjectCount === 1 ? "" : "s"}.`
          : `Removed "${selectedItem.label}".`;
      showToast(message, "info");
      render();
    });
  });

  cameraNavToggleButton.addEventListener("click", () => {
    toggleCameraNavigationMode();
  });

  for (const button of transformModeButtons) {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.transformMode;
      if (nextMode === "move" || nextMode === "rotate" || nextMode === "scale") {
        setTransformMode(nextMode);
      }
    });
  }

  advancedToolsToggleButton.addEventListener("click", () => {
    setAdvancedToolsOpen(!advancedToolsOpen);
  });

  advancedToolsCloseButton.addEventListener("click", () => {
    setAdvancedToolsOpen(false);
  });

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (advancedToolsOpen && !advancedToolsPanel.contains(target) && !advancedToolsToggleButton.contains(target)) {
      setAdvancedToolsOpen(false);
    }

    if (
      activeLibraryTab === "assets" &&
      rolloutPanel.classList.contains("is-visible") &&
      !rolloutPanel.contains(target) &&
      !libraryPanel.contains(target)
    ) {
      assetRolloutDismissed = true;
      rolloutPanel.classList.remove("is-visible");
    }
  };

  document.addEventListener("pointerdown", handleDocumentPointerDown);

  uploadAssetInput.addEventListener("change", () => {
    const files = Array.from(uploadAssetInput.files ?? []);
    if (files.length === 0) {
      return;
    }

    const requestedCategory = window.prompt("Category for this upload batch:", DEFAULT_UPLOADED_ASSET_CATEGORY);
    if (requestedCategory === null) {
      uploadAssetInput.value = "";
      return;
    }

    void sceneBuilder.uploadAssets(files, { category: requestedCategory }).then((result) => {
      uploadAssetInput.value = "";

      const uploadedCount = result.uploaded.length;
      const failedCount = result.failed.length;
      if (uploadedCount === 0) {
        const firstFailure = result.failed[0]?.error ?? "Asset upload failed.";
        showToast(firstFailure, "error");
        return;
      }

      if (failedCount === 0) {
        showToast(
          `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"} to ${result.category}.`,
          "success"
        );
      } else {
        showToast(
          `Uploaded ${uploadedCount} asset${uploadedCount === 1 ? "" : "s"} and skipped ${failedCount}.`,
          "info"
        );
      }
      render();
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
        render();
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

    const includesUploadedAssets = layoutJson.includes("\"assetId\": \"local-uploaded:");
    const portabilityNote = includesUploadedAssets
      ? " JSON format is layout-only and will not include uploaded asset binaries."
      : "";
    showToast(`Downloaded ${fileName}.${portabilityNote}`, includesUploadedAssets ? "info" : "success");
  });

  downloadWorldPackageButton.addEventListener("click", () => {
    const targetWorldName = worldNameDraft || worldState.currentWorldName || "untitled-world";
    void sceneBuilder
      .exportWorldPackage(targetWorldName)
      .then((result) => {
        const objectUrl = URL.createObjectURL(result.blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);

        const uploadSuffix = result.uploadedAssetCount
          ? ` Included ${result.uploadedAssetCount} uploaded asset${result.uploadedAssetCount === 1 ? "" : "s"}.`
          : "";
        showToast(`Downloaded ${result.fileName}.${uploadSuffix}`, "success");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "World package could not be created.";
        showToast(message, "error");
      });
  });

  uploadWorldPackageButton.addEventListener("click", () => {
    uploadWorldPackageInput.click();
  });

  uploadWorldPackageInput.addEventListener("change", () => {
    const file = uploadWorldPackageInput.files?.[0];
    if (!file) {
      return;
    }

    void sceneBuilder
      .importWorldPackage(file)
      .then((result) => {
        if (!result.success) {
          showToast(result.error ?? "World package could not be imported.", "error");
          return;
        }

        const remapSuffix = result.remappedAssetCount
          ? ` Remapped ${result.remappedAssetCount} conflicting asset id${result.remappedAssetCount === 1 ? "" : "s"}.`
          : "";
        showToast(`Imported ${file.name}.${remapSuffix}`, "success");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "World package could not be imported.";
        showToast(message, "error");
      })
      .finally(() => {
        uploadWorldPackageInput.value = "";
      });
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
    if (window.innerWidth <= MOBILE_BREAKPOINT || libraryPanelCollapsed) {
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
    if (window.innerWidth <= MOBILE_BREAKPOINT || libraryPanelCollapsed) {
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
  renderSidePanelToggles();
  setActiveLibraryTab(activeLibraryTab);
  setAdvancedToolsOpen(false);
  maybeDebugUploadAsset();
  resizeCleanup = () => {
    setAdvancedToolsOpen(false);
    handlePointerUp();
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("keydown", handleShortcutKeyDown);
    libraryPanelToggleButton.remove();
    inspectorPanelToggleButton.remove();
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
