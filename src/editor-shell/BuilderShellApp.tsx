import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";

import { DEFAULT_UPLOADED_ASSET_CATEGORY } from "../generation/natureKitAssetManifest";
import type { BuilderShellStoreState } from "./builderShellStore";
import { createBuilderShellStore } from "./builderShellStore";
import type { SceneBuilderAdapter } from "./sceneBuilderAdapter";

interface BuilderShellHosts {
  libraryPanel: HTMLElement;
  inspectorPanel: HTMLElement;
  toastHost: HTMLElement;
}

interface BuilderShellAppProps {
  adapter: SceneBuilderAdapter;
  hosts: BuilderShellHosts;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function BuilderShellApp({ adapter, hosts }: BuilderShellAppProps) {
  const store = useMemo(() => createBuilderShellStore(adapter), [adapter]);

  useEffect(() => {
    const unsubscribeAdapter = adapter.subscribe(() => {
      store.getState().refreshFromAdapter();
    });
    store.getState().refreshFromAdapter();

    return () => {
      unsubscribeAdapter();
    };
  }, [adapter, store]);

  useEffect(() => {
    const handleShortcutKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const state = store.getState();
      const key = event.key.toLowerCase();
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (isModifierPressed && key === "z" && !event.shiftKey) {
        event.preventDefault();
        void state.undo();
        return;
      }

      if ((isModifierPressed && key === "z" && event.shiftKey) || (isModifierPressed && key === "y")) {
        event.preventDefault();
        void state.redo();
        return;
      }

      if (key === "c") {
        event.preventDefault();
        state.toggleCameraNavigation();
        return;
      }

      if (key === "1") {
        event.preventDefault();
        state.setTransformMode("move");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        state.setTransformMode("rotate");
        return;
      }

      if (key === "3") {
        event.preventDefault();
        state.setTransformMode("scale");
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        state.selectObjectById(null);
      }
    };

    window.addEventListener("keydown", handleShortcutKeyDown);
    return () => {
      window.removeEventListener("keydown", handleShortcutKeyDown);
    };
  }, [store]);

  const snapshot = useStore(store, (state: BuilderShellStoreState) => state.snapshot);
  const selectedAssetId = useStore(store, (state: BuilderShellStoreState) => state.selectedAssetId);
  const worldState = useStore(store, (state: BuilderShellStoreState) => state.worldState);
  const worldNameDraft = useStore(store, (state: BuilderShellStoreState) => state.worldNameDraft);
  const transformMode = useStore(store, (state: BuilderShellStoreState) => state.transformMode);
  const cameraNavigationEnabled = useStore(store, (state: BuilderShellStoreState) => state.cameraNavigationEnabled);
  const statusNotice = useStore(store, (state: BuilderShellStoreState) => state.statusNotice);
  const uploadInputValueKey = useStore(store, (state: BuilderShellStoreState) => state.uploadInputValueKey);

  const saveButtonLabel = worldState.hasSavedWorld ? "Save Changes" : "Save New";
  const compactWorldState = worldState.isDirty ? "Unsaved" : worldState.hasSavedWorld ? "Saved" : "New";
  const worldStatusTitle = `${worldState.persistenceMessage}${worldState.isDirty ? " Unsaved changes." : ""}`.trim();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [leftTab, setLeftTab] = useState<"assets" | "hierarchy">("assets");
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSourceFilter, setAssetSourceFilter] = useState<"all" | "built-in" | "uploaded">("all");
  const [assetSortMode, setAssetSortMode] = useState<"label-asc" | "label-desc" | "recent-upload">("label-asc");

  const filteredPalette = useMemo(() => {
    const query = assetSearchQuery.trim().toLowerCase();

    const matchesQuery = (label: string): boolean => {
      if (!query) {
        return true;
      }

      return label.toLowerCase().includes(query);
    };

    const matchesSource = (sourceType: "built-in" | "uploaded"): boolean => {
      if (assetSourceFilter === "all") {
        return true;
      }

      return sourceType === assetSourceFilter;
    };

    const filtered = snapshot.palette.filter((item) => matchesSource(item.sourceType) && matchesQuery(item.label));

    if (assetSortMode === "label-desc") {
      return filtered.sort((left, right) => right.label.localeCompare(left.label));
    }

    if (assetSortMode === "recent-upload") {
      return filtered.sort((left, right) => {
        const leftTimestamp = left.uploadedAt ? Date.parse(left.uploadedAt) : 0;
        const rightTimestamp = right.uploadedAt ? Date.parse(right.uploadedAt) : 0;
        const leftSafeTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
        const rightSafeTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;
        return rightSafeTimestamp - leftSafeTimestamp || left.label.localeCompare(right.label);
      });
    }

    return filtered.sort((left, right) => left.label.localeCompare(right.label));
  }, [assetSearchQuery, assetSourceFilter, assetSortMode, snapshot.palette]);

  const selectedPaletteItem = useMemo(
    () => snapshot.palette.find((item) => item.assetId === selectedAssetId) ?? null,
    [selectedAssetId, snapshot.palette]
  );

  const handleUploadClick = (): void => {
    uploadInputRef.current?.click();
  };

  const handleUploadInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const category = window.prompt("Category for this upload batch:", DEFAULT_UPLOADED_ASSET_CATEGORY);
    if (category === null) {
      event.target.value = "";
      return;
    }

    void store.getState().uploadAssets(files, category).finally(() => {
      event.target.value = "";
    });
  };

  const toolbar = (
    <div className="builder-top-bar-main builder-v2-toolbar-main">
      <div className="builder-top-bar-actions builder-top-bar-actions-world">
        <span className="builder-panel-kicker">Scene</span>
        <label className="builder-field builder-top-bar-field">
          <span className="builder-visually-hidden">World name</span>
          <input
            id="builder-world-name"
            type="text"
            maxLength={80}
            placeholder="World name"
            aria-label="World name"
            value={worldNameDraft}
            onChange={(event) => {
              store.getState().setWorldNameDraft(event.target.value);
            }}
          />
        </label>
        <button id="builder-save-world" className="ui-button builder-button builder-button-primary" type="button" onClick={() => {
          store.getState().saveWorld();
        }}>{saveButtonLabel}</button>
        <button id="builder-save-world-as" className="ui-button builder-button" type="button" onClick={() => {
          store.getState().saveWorldAs();
        }}>Save As</button>
        <button id="builder-view-world" className="ui-button builder-button" type="button" disabled={!worldState.hasSavedWorld} onClick={() => {
          store.getState().viewWorld();
        }}>View Saved</button>
        <button id="builder-back-to-menu" className="ui-button builder-button" type="button" onClick={() => {
          store.getState().backToMenu();
        }}>Back To Menu</button>
      </div>
      <div className="builder-top-bar-actions builder-top-bar-actions-tools">
        <div className="builder-toolbar-group builder-toolbar-group-edit">
          <button
            id="builder-camera-nav-toggle"
            className={`ui-button builder-button builder-button-camera${cameraNavigationEnabled ? " builder-button-primary" : ""}`}
            type="button"
            aria-pressed={cameraNavigationEnabled}
            onClick={() => {
              store.getState().toggleCameraNavigation();
            }}
          >
            {cameraNavigationEnabled ? "Camera Nav Mode" : "Object Edit Mode"}
          </button>
          <div className="builder-transform-mode-group" role="group" aria-label="Transform mode">
            {(["move", "rotate", "scale"] as const).map((mode) => {
              const isActive = mode === transformMode;
              return (
                <button
                  key={mode}
                  id={`builder-transform-mode-${mode}`}
                  className={`ui-button builder-button builder-transform-mode-button${isActive ? " builder-button-primary is-active" : ""}`}
                  type="button"
                  data-transform-mode={mode}
                  aria-pressed={isActive}
                  onClick={() => {
                    store.getState().setTransformMode(mode);
                  }}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="builder-toolbar-group builder-toolbar-group-utility">
          <button id="builder-toolbar-upload-asset" className="ui-button builder-button" type="button" title="Upload .glb assets" onClick={handleUploadClick}>Upload Assets</button>
          <input
            key={uploadInputValueKey}
            id="builder-upload-asset-input"
            ref={uploadInputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            multiple
            hidden
            onChange={handleUploadInputChange}
          />
          <button id="builder-undo" className="ui-button builder-button" type="button" title="Undo (Ctrl/Cmd+Z)" onClick={() => {
            void store.getState().undo();
          }}>Undo</button>
          <button id="builder-redo" className="ui-button builder-button" type="button" title="Redo (Ctrl/Cmd+Shift+Z)" onClick={() => {
            void store.getState().redo();
          }}>Redo</button>
          <button id="builder-advanced-tools-toggle" className="ui-button builder-button" type="button" aria-expanded="false" disabled>Advanced Tools</button>
          <p id="builder-world-status" className="builder-status builder-world-status" aria-live="polite" title={worldStatusTitle}>{compactWorldState}</p>
        </div>
      </div>
    </div>
  );

  const leftPanel = (
    <>
      <div className="builder-panel-header builder-pane-header">
        <p className="builder-panel-kicker">Project</p>
        <h2>Left Pane</h2>
        <p className="builder-panel-copy">Switch between asset browsing and scene hierarchy workflows.</p>
      </div>
      <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-library-tools">
        <div className="builder-panel-tabs builder-pane-mode-tabs" role="tablist" aria-label="Builder left panel tabs">
          <button
            id="builder-tab-assets"
            className={`builder-tab${leftTab === "assets" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={leftTab === "assets"}
            aria-controls="builder-assets-panel"
            data-builder-tab="assets"
            onClick={() => {
              setLeftTab("assets");
            }}
          >
            Assets
          </button>
          <button
            id="builder-tab-scene"
            className={`builder-tab${leftTab === "hierarchy" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={leftTab === "hierarchy"}
            aria-controls="builder-scene-panel"
            data-builder-tab="scene"
            onClick={() => {
              setLeftTab("hierarchy");
            }}
          >
            Hierarchy
          </button>
        </div>
      </div>
      <div id="builder-assets-panel" className={`builder-tab-panel builder-pane-surface builder-pane-surface-assets builder-assets-pane-layout${leftTab === "assets" ? " is-active" : ""}`} role="tabpanel" hidden={leftTab !== "assets"}>
        <div className="builder-assets-pane-top">
          <div className="builder-pane-subheader">
            <p className="builder-panel-label">Assets</p>
            <button id="builder-upload-asset" className="ui-button builder-button" type="button" onClick={handleUploadClick}>Upload</button>
          </div>
          <div className="builder-asset-browser-controls">
            <label className="builder-field builder-asset-search-row">
              <span>Search</span>
              <input
                id="builder-asset-search"
                type="search"
                placeholder="Filter assets"
                value={assetSearchQuery}
                onChange={(event) => {
                  setAssetSearchQuery(event.target.value);
                }}
              />
            </label>
            <div className="builder-asset-filter-row">
              <label className="builder-field">
                <span>Source</span>
                <select
                  id="builder-asset-source-filter"
                  className="builder-select"
                  value={assetSourceFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all" || value === "built-in" || value === "uploaded") {
                      setAssetSourceFilter(value);
                    }
                  }}
                >
                  <option value="all">All</option>
                  <option value="built-in">Built-in</option>
                  <option value="uploaded">Uploaded</option>
                </select>
              </label>
              <label className="builder-field">
                <span>Sort</span>
                <select
                  id="builder-asset-sort"
                  className="builder-select"
                  value={assetSortMode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "label-asc" || value === "label-desc" || value === "recent-upload") {
                      setAssetSortMode(value);
                    }
                  }}
                >
                  <option value="label-asc">Name A-Z</option>
                  <option value="label-desc">Name Z-A</option>
                  <option value="recent-upload">Recent Uploads</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="builder-assets-pane-list-region">
          <div id="builder-palette">
            {filteredPalette.length === 0 ? (
              <div className="builder-editor-hint" role="status">
                <p className="builder-selection-title">No matching assets</p>
                <p className="builder-selection-meta">Adjust search/filter or upload a .glb asset.</p>
              </div>
            ) : (
              <div className="builder-palette-group builder-asset-pane-list" data-palette-group="all">
                <p className="builder-palette-group-title">Asset Library ({filteredPalette.length})</p>
                <div className="builder-palette-group-items">
                  {filteredPalette.map((item) => {
                    const isSelected = item.assetId === selectedAssetId;
                    return (
                      <button
                        key={item.assetId}
                        className={`builder-palette-item${isSelected ? " is-selected" : ""}`}
                        type="button"
                        data-asset-id={item.assetId}
                        aria-pressed={isSelected}
                        onClick={() => {
                          store.getState().setSelectedAsset(item.assetId);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="builder-assets-pane-footer builder-panel-section builder-panel-section-tight builder-asset-selection-inline">
          {selectedPaletteItem ? (
            <>
              <p className="builder-panel-label">Selected Asset</p>
              <p className="builder-selection-title">{selectedPaletteItem.label}</p>
              <p className="builder-selection-meta">{selectedPaletteItem.sourceType === "uploaded" ? "Uploaded" : "Built-in"}</p>
              <button
                id="builder-place-asset"
                className="ui-button builder-button builder-button-primary builder-button-block"
                type="button"
                disabled={!snapshot.isReady || !selectedAssetId}
                onClick={() => {
                  void store.getState().placeSelectedAsset();
                }}
              >
                Add to scene
              </button>
            </>
          ) : (
            <div className="builder-editor-hint" role="status">
              <p className="builder-selection-title">No asset selected</p>
              <p className="builder-selection-meta">Select an asset to place it in the scene.</p>
            </div>
          )}
        </div>
      </div>
      <div id="builder-scene-panel" className={`builder-tab-panel builder-pane-surface builder-pane-surface-hierarchy${leftTab === "hierarchy" ? " is-active" : ""}`} role="tabpanel" hidden={leftTab !== "hierarchy"}>
        <div className="builder-pane-subheader">
          <p className="builder-panel-label">Hierarchy</p>
          <p className="builder-pane-subheader-meta">{snapshot.objects.length} object{snapshot.objects.length === 1 ? "" : "s"}</p>
        </div>
        <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-fill">
          <div id="builder-scene-objects" className="builder-scene-object-list">
            {snapshot.objects.length === 0 ? (
              <div className="builder-editor-hint" role="status">
                <p className="builder-selection-title">Hierarchy is empty</p>
                <p className="builder-selection-meta">Add an asset to create the first scene object.</p>
              </div>
            ) : (
              snapshot.objects.map((object) => {
                const isSelected = object.id === snapshot.selectedObjectId;
                return (
                  <button
                    key={object.id}
                    className={`builder-scene-object-item${isSelected ? " is-selected" : ""}`}
                    type="button"
                    data-object-id={object.id}
                    onClick={() => {
                      store.getState().selectObjectById(object.id);
                    }}
                  >
                    {object.assetLabel}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );

  const inspectorPanel = (
    <>
      <div className="builder-panel-header builder-pane-header">
        <p className="builder-panel-kicker">Inspector</p>
        <h2>Properties</h2>
        <p className="builder-panel-copy">Edit selected object properties in a compact property panel.</p>
      </div>
      <div className="builder-panel-section builder-panel-section-no-border builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Object</span>
        <div id="builder-selection-summary" className="builder-selection-summary">
          {snapshot.selectedObject ? (
            <div className="builder-selection-card">
              <p className="builder-selection-title">{snapshot.selectedObject.assetLabel}</p>
              <p className="builder-selection-meta">{snapshot.selectedObject.id}</p>
              <p className="builder-selection-meta">{snapshot.selectedObject.assetId}</p>
            </div>
          ) : (
            <div className="builder-editor-hint" role="status">
              <p className="builder-selection-title">No object selected</p>
              <p className="builder-selection-meta">Select from Hierarchy or click an object in the viewport to inspect properties.</p>
              <p className="builder-selection-meta">Placed objects: {snapshot.objects.length}</p>
            </div>
          )}
        </div>
      </div>
      <div className="builder-panel-section builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Transform</span>
        <div className="builder-property-grid">
          <label className="builder-property-row">
            <span className="builder-property-label">Position X</span>
            <input
              id="builder-pos-x"
              type="number"
              step="0.1"
              disabled={!snapshot.selectedObject}
              value={snapshot.selectedObject ? snapshot.selectedObject.position.x : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { x: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Position Y</span>
            <input
              id="builder-pos-y"
              type="number"
              step="0.1"
              disabled={!snapshot.selectedObject}
              value={snapshot.selectedObject ? snapshot.selectedObject.position.y : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { y: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Position Z</span>
            <input
              id="builder-pos-z"
              type="number"
              step="0.1"
              disabled={!snapshot.selectedObject}
              value={snapshot.selectedObject ? snapshot.selectedObject.position.z : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ position: { z: value } });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Rotation Y</span>
            <input
              id="builder-rot-y"
              type="number"
              step="0.1"
              disabled={!snapshot.selectedObject}
              value={snapshot.selectedObject ? snapshot.selectedObject.rotationY : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ rotationY: value });
                }
              }}
            />
          </label>
          <label className="builder-property-row">
            <span className="builder-property-label">Scale</span>
            <input
              id="builder-scale"
              type="number"
              min="0.1"
              step="0.1"
              disabled={!snapshot.selectedObject}
              value={snapshot.selectedObject ? snapshot.selectedObject.scale : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  store.getState().updateSelectedTransform({ scale: value });
                }
              }}
            />
          </label>
        </div>
        <div className="builder-action-row builder-action-row-split builder-inspector-utility-row">
          <button
            className="ui-button builder-button"
            type="button"
            data-move-axis="x"
            data-move-delta="-0.25"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              store.getState().nudgeSelectedObject("x", -0.25);
            }}
          >
            Nudge X-
          </button>
          <button
            className="ui-button builder-button"
            type="button"
            data-move-axis="x"
            data-move-delta="0.25"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              store.getState().nudgeSelectedObject("x", 0.25);
            }}
          >
            Nudge X+
          </button>
        </div>
        <div className="builder-action-row builder-action-row-split builder-inspector-utility-row">
          <button
            className="ui-button builder-button"
            type="button"
            data-rotate-delta="-15"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              store.getState().rotateSelectedObject(-15);
            }}
          >
            Rotate -15
          </button>
          <button
            className="ui-button builder-button"
            type="button"
            data-rotate-delta="15"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              store.getState().rotateSelectedObject(15);
            }}
          >
            Rotate +15
          </button>
        </div>
      </div>
      <div className="builder-panel-section builder-panel-section-tight builder-inspector-section">
        <span className="builder-panel-label">Actions</span>
        <div className="builder-action-row builder-action-row-split builder-inspector-actions-row">
          <button
            id="builder-duplicate"
            className="ui-button builder-button"
            type="button"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              void store.getState().duplicateSelectedObject();
            }}
          >
            Duplicate
          </button>
          <button
            id="builder-delete"
            className="ui-button builder-button builder-button-danger"
            type="button"
            disabled={!snapshot.selectedObject}
            onClick={() => {
              store.getState().deleteSelectedObject();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <p id="builder-status" className="builder-status">{snapshot.statusMessage}</p>
    </>
  );

  const toast = statusNotice ? (
    <div className="builder-toast builder-toast-info" role="status">
      <span>{statusNotice}</span>
      <button className="builder-toast-close" type="button" aria-label="Dismiss notification" onClick={() => {
        store.getState().clearStatusNotice();
      }}>x</button>
    </div>
  ) : null;

  return (
    <>
      {toolbar}
      {createPortal(leftPanel, hosts.libraryPanel)}
      {createPortal(inspectorPanel, hosts.inspectorPanel)}
      {createPortal(toast, hosts.toastHost)}
    </>
  );
}
