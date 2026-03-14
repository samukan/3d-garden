export const leftPanelMarkup = `
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

export const rolloutPanelMarkup = `
  <div id="builder-rollout-panel" class="builder-rollout-panel">
    <div id="builder-rollout-content" class="builder-rollout-content"></div>
  </div>
`;

export interface BuilderLeftPanelElements {
  assetsTabButton: HTMLButtonElement;
  sceneTabButton: HTMLButtonElement;
  assetsTabPanel: HTMLElement;
  sceneTabPanel: HTMLElement;
  uploadAssetInput: HTMLInputElement;
  uploadAssetButton: HTMLButtonElement;
  removeUploadButton: HTMLButtonElement;
  clearUploadsButton: HTMLButtonElement;
  uploadSortSelect: HTMLSelectElement;
  renameCategoryButton: HTMLButtonElement;
  paletteElement: HTMLElement;
  sceneObjectsElement: HTMLElement;
}

export function getBuilderLeftPanelElements(libraryPanel: HTMLElement): BuilderLeftPanelElements | null {
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
  const paletteElement = libraryPanel.querySelector<HTMLElement>("#builder-palette");
  const sceneObjectsElement = libraryPanel.querySelector<HTMLElement>("#builder-scene-objects");

  if (
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
    !paletteElement ||
    !sceneObjectsElement
  ) {
    return null;
  }

  return {
    assetsTabButton,
    sceneTabButton,
    assetsTabPanel,
    sceneTabPanel,
    uploadAssetInput,
    uploadAssetButton,
    removeUploadButton,
    clearUploadsButton,
    uploadSortSelect,
    renameCategoryButton,
    paletteElement,
    sceneObjectsElement
  };
}

export function createLeftRolloutPanel(libraryPanel: HTMLElement): { rolloutPanel: HTMLElement; rolloutContentElement: HTMLElement } | null {
  const rolloutContainer = document.createElement("div");
  rolloutContainer.innerHTML = rolloutPanelMarkup;
  const rolloutPanel = rolloutContainer.firstElementChild;
  if (!(rolloutPanel instanceof HTMLElement)) {
    return null;
  }

  libraryPanel.parentElement?.insertBefore(rolloutPanel, libraryPanel.nextSibling);
  const rolloutContentElement = rolloutPanel.querySelector<HTMLElement>("#builder-rollout-content");
  if (!rolloutContentElement) {
    rolloutPanel.remove();
    return null;
  }

  return { rolloutPanel, rolloutContentElement };
}
