export const toolbarMarkup = `
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
      <button id="builder-toolbar-upload-asset" class="ui-button builder-button" type="button" title="Upload .glb assets">Upload Assets</button>
      <button id="builder-undo" class="ui-button builder-button" type="button" title="Undo (Ctrl/Cmd+Z)">Undo</button>
      <button id="builder-redo" class="ui-button builder-button" type="button" title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
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
    <div class="builder-panel-section builder-panel-section-tight builder-camera-routes">
      <p class="builder-panel-kicker">Camera Routes</p>
      <div class="builder-action-row builder-action-row-split">
        <button id="builder-route-mode-toggle" class="ui-button builder-button builder-button-block" type="button" aria-pressed="false">Route Mode Off</button>
        <button id="builder-route-create" class="ui-button builder-button builder-button-block" type="button">Create Route</button>
      </div>
      <div class="builder-action-row builder-action-row-split">
        <button id="builder-route-add-point" class="ui-button builder-button builder-button-block" type="button">Add Current Camera Point</button>
        <button id="builder-route-delete" class="ui-button builder-button builder-button-danger builder-button-block" type="button">Delete Route</button>
      </div>
      <label class="builder-field builder-advanced-tools-label" for="builder-route-select">
        <span>Selected Route</span>
        <select id="builder-route-select" class="builder-select"></select>
      </label>
      <label class="builder-field builder-advanced-tools-label" for="builder-route-default-select">
        <span>Default Route</span>
        <select id="builder-route-default-select" class="builder-select"></select>
      </label>
      <div class="builder-field-grid builder-route-settings-grid">
        <label class="builder-field builder-field-full">
          <span>Route Name</span>
          <input id="builder-route-name" type="text" maxlength="80" />
        </label>
        <label class="builder-field builder-field-inline">
          <span>Loop route</span>
          <input id="builder-route-loop" type="checkbox" />
        </label>
        <label class="builder-field">
          <span>Easing</span>
          <select id="builder-route-easing" class="builder-select">
            <option value="easeInOutSine">easeInOutSine</option>
            <option value="linear">linear</option>
          </select>
        </label>
        <label class="builder-field">
          <span>Timing Mode</span>
          <select id="builder-route-timing-mode" class="builder-select">
            <option value="duration">Duration</option>
            <option value="speed">Speed</option>
          </select>
        </label>
        <label class="builder-field">
          <span id="builder-route-timing-value-label">Duration (ms)</span>
          <input id="builder-route-timing-value" type="number" min="0" step="100" />
        </label>
        <label class="builder-field">
          <span>New Point Dwell (ms)</span>
          <input id="builder-route-dwell-ms" type="number" min="0" step="50" value="0" />
        </label>
      </div>
      <div class="builder-action-row builder-action-row-split">
        <button id="builder-route-preview" class="ui-button builder-button builder-button-block" type="button">Preview Route</button>
        <button id="builder-route-stop" class="ui-button builder-button builder-button-block" type="button">Stop Preview</button>
      </div>
      <div id="builder-route-points" class="builder-route-points"></div>
    </div>
    <label class="builder-textarea-label builder-advanced-tools-label" for="builder-layout-json">Manual JSON (advanced)</label>
    <textarea id="builder-layout-json" class="builder-textarea builder-advanced-tools-json" spellcheck="false"></textarea>
  </div>
`;

export interface BuilderToolbarElements {
  toolbarUploadAssetButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  cameraNavToggleButton: HTMLButtonElement;
  transformModeButtons: HTMLButtonElement[];
  advancedToolsToggleButton: HTMLButtonElement;
  advancedToolsPanel: HTMLElement;
  advancedToolsCloseButton: HTMLButtonElement;
  worldStatusElement: HTMLElement;
  worldNameInput: HTMLInputElement;
  layoutTextarea: HTMLTextAreaElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  downloadWorldPackageButton: HTMLButtonElement;
  uploadWorldPackageButton: HTMLButtonElement;
  uploadWorldPackageInput: HTMLInputElement;
  downloadWorldJsonButton: HTMLButtonElement;
  uploadWorldJsonButton: HTMLButtonElement;
  uploadWorldJsonInput: HTMLInputElement;
  routeModeToggleButton: HTMLButtonElement;
  routeCreateButton: HTMLButtonElement;
  routeAddPointButton: HTMLButtonElement;
  routeDeleteButton: HTMLButtonElement;
  routeSelect: HTMLSelectElement;
  routeDefaultSelect: HTMLSelectElement;
  routeNameInput: HTMLInputElement;
  routeLoopInput: HTMLInputElement;
  routeEasingSelect: HTMLSelectElement;
  routeTimingModeSelect: HTMLSelectElement;
  routeTimingValueLabel: HTMLElement;
  routeTimingValueInput: HTMLInputElement;
  routeDwellInput: HTMLInputElement;
  routePreviewButton: HTMLButtonElement;
  routeStopButton: HTMLButtonElement;
  routePointsElement: HTMLElement;
  saveWorldButton: HTMLButtonElement;
  saveWorldAsButton: HTMLButtonElement;
  viewWorldButton: HTMLButtonElement;
  backToMenuButton: HTMLButtonElement;
}

export function getBuilderToolbarElements(topBar: HTMLElement): BuilderToolbarElements | null {
  const toolbarUploadAssetButton = topBar.querySelector<HTMLButtonElement>("#builder-toolbar-upload-asset");
  const undoButton = topBar.querySelector<HTMLButtonElement>("#builder-undo");
  const redoButton = topBar.querySelector<HTMLButtonElement>("#builder-redo");
  const cameraNavToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-camera-nav-toggle");
  const transformModeButtons = Array.from(topBar.querySelectorAll<HTMLButtonElement>("[data-transform-mode]"));
  const advancedToolsToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-advanced-tools-toggle");
  const advancedToolsPanel = topBar.querySelector<HTMLElement>("#builder-advanced-tools-panel");
  const advancedToolsCloseButton = topBar.querySelector<HTMLButtonElement>("#builder-advanced-tools-close");
  const worldStatusElement = topBar.querySelector<HTMLElement>("#builder-world-status");
  const worldNameInput = topBar.querySelector<HTMLInputElement>("#builder-world-name");
  const layoutTextarea = topBar.querySelector<HTMLTextAreaElement>("#builder-layout-json");
  const exportButton = topBar.querySelector<HTMLButtonElement>("#builder-export");
  const importButton = topBar.querySelector<HTMLButtonElement>("#builder-import");
  const downloadWorldPackageButton = topBar.querySelector<HTMLButtonElement>("#builder-download-world-package");
  const uploadWorldPackageButton = topBar.querySelector<HTMLButtonElement>("#builder-upload-world-package");
  const uploadWorldPackageInput = topBar.querySelector<HTMLInputElement>("#builder-upload-world-package-input");
  const downloadWorldJsonButton = topBar.querySelector<HTMLButtonElement>("#builder-download-world-json");
  const uploadWorldJsonButton = topBar.querySelector<HTMLButtonElement>("#builder-upload-world-json");
  const uploadWorldJsonInput = topBar.querySelector<HTMLInputElement>("#builder-upload-world-json-input");
  const routeModeToggleButton = topBar.querySelector<HTMLButtonElement>("#builder-route-mode-toggle");
  const routeCreateButton = topBar.querySelector<HTMLButtonElement>("#builder-route-create");
  const routeAddPointButton = topBar.querySelector<HTMLButtonElement>("#builder-route-add-point");
  const routeDeleteButton = topBar.querySelector<HTMLButtonElement>("#builder-route-delete");
  const routeSelect = topBar.querySelector<HTMLSelectElement>("#builder-route-select");
  const routeDefaultSelect = topBar.querySelector<HTMLSelectElement>("#builder-route-default-select");
  const routeNameInput = topBar.querySelector<HTMLInputElement>("#builder-route-name");
  const routeLoopInput = topBar.querySelector<HTMLInputElement>("#builder-route-loop");
  const routeEasingSelect = topBar.querySelector<HTMLSelectElement>("#builder-route-easing");
  const routeTimingModeSelect = topBar.querySelector<HTMLSelectElement>("#builder-route-timing-mode");
  const routeTimingValueLabel = topBar.querySelector<HTMLElement>("#builder-route-timing-value-label");
  const routeTimingValueInput = topBar.querySelector<HTMLInputElement>("#builder-route-timing-value");
  const routeDwellInput = topBar.querySelector<HTMLInputElement>("#builder-route-dwell-ms");
  const routePreviewButton = topBar.querySelector<HTMLButtonElement>("#builder-route-preview");
  const routeStopButton = topBar.querySelector<HTMLButtonElement>("#builder-route-stop");
  const routePointsElement = topBar.querySelector<HTMLElement>("#builder-route-points");
  const saveWorldButton = topBar.querySelector<HTMLButtonElement>("#builder-save-world");
  const saveWorldAsButton = topBar.querySelector<HTMLButtonElement>("#builder-save-world-as");
  const viewWorldButton = topBar.querySelector<HTMLButtonElement>("#builder-view-world");
  const backToMenuButton = topBar.querySelector<HTMLButtonElement>("#builder-back-to-menu");

  if (
    !toolbarUploadAssetButton ||
    !undoButton ||
    !redoButton ||
    !cameraNavToggleButton ||
    transformModeButtons.length !== 3 ||
    !advancedToolsToggleButton ||
    !advancedToolsPanel ||
    !advancedToolsCloseButton ||
    !worldStatusElement ||
    !worldNameInput ||
    !layoutTextarea ||
    !exportButton ||
    !importButton ||
    !downloadWorldPackageButton ||
    !uploadWorldPackageButton ||
    !uploadWorldPackageInput ||
    !downloadWorldJsonButton ||
    !uploadWorldJsonButton ||
    !uploadWorldJsonInput ||
    !routeModeToggleButton ||
    !routeCreateButton ||
    !routeAddPointButton ||
    !routeDeleteButton ||
    !routeSelect ||
    !routeDefaultSelect ||
    !routeNameInput ||
    !routeLoopInput ||
    !routeEasingSelect ||
    !routeTimingModeSelect ||
    !routeTimingValueLabel ||
    !routeTimingValueInput ||
    !routeDwellInput ||
    !routePreviewButton ||
    !routeStopButton ||
    !routePointsElement ||
    !saveWorldButton ||
    !saveWorldAsButton ||
    !viewWorldButton ||
    !backToMenuButton
  ) {
    return null;
  }

  return {
    toolbarUploadAssetButton,
    undoButton,
    redoButton,
    cameraNavToggleButton,
    transformModeButtons,
    advancedToolsToggleButton,
    advancedToolsPanel,
    advancedToolsCloseButton,
    worldStatusElement,
    worldNameInput,
    layoutTextarea,
    exportButton,
    importButton,
    downloadWorldPackageButton,
    uploadWorldPackageButton,
    uploadWorldPackageInput,
    downloadWorldJsonButton,
    uploadWorldJsonButton,
    uploadWorldJsonInput,
    routeModeToggleButton,
    routeCreateButton,
    routeAddPointButton,
    routeDeleteButton,
    routeSelect,
    routeDefaultSelect,
    routeNameInput,
    routeLoopInput,
    routeEasingSelect,
    routeTimingModeSelect,
    routeTimingValueLabel,
    routeTimingValueInput,
    routeDwellInput,
    routePreviewButton,
    routeStopButton,
    routePointsElement,
    saveWorldButton,
    saveWorldAsButton,
    viewWorldButton,
    backToMenuButton
  };
}
