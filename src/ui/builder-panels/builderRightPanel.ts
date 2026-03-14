export const rightPanelMarkup = `
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

export interface BuilderRightPanelElements {
  selectionSummaryElement: HTMLElement;
  statusElement: HTMLElement;
  duplicateButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  posXInput: HTMLInputElement;
  posYInput: HTMLInputElement;
  posZInput: HTMLInputElement;
  rotYInput: HTMLInputElement;
  scaleInput: HTMLInputElement;
  moveControlsElement: HTMLElement;
  rotationControlsElement: HTMLElement;
}

export function getBuilderRightPanelElements(inspectorPanel: HTMLElement): BuilderRightPanelElements | null {
  const selectionSummaryElement = inspectorPanel.querySelector<HTMLElement>("#builder-selection-summary");
  const statusElement = inspectorPanel.querySelector<HTMLElement>("#builder-status");
  const duplicateButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-duplicate");
  const deleteButton = inspectorPanel.querySelector<HTMLButtonElement>("#builder-delete");
  const posXInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-x");
  const posYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-y");
  const posZInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-pos-z");
  const rotYInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-rot-y");
  const scaleInput = inspectorPanel.querySelector<HTMLInputElement>("#builder-scale");
  const moveControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-move-controls");
  const rotationControlsElement = inspectorPanel.querySelector<HTMLElement>("#builder-rotation-controls");

  if (
    !selectionSummaryElement ||
    !statusElement ||
    !duplicateButton ||
    !deleteButton ||
    !posXInput ||
    !posYInput ||
    !posZInput ||
    !rotYInput ||
    !scaleInput ||
    !moveControlsElement ||
    !rotationControlsElement
  ) {
    return null;
  }

  return {
    selectionSummaryElement,
    statusElement,
    duplicateButton,
    deleteButton,
    posXInput,
    posYInput,
    posZInput,
    rotYInput,
    scaleInput,
    moveControlsElement,
    rotationControlsElement
  };
}
