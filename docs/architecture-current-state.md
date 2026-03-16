# Skill Garden Architecture (Current State)

This document describes the current runtime architecture and project direction.
It is intentionally practical and focused on what is implemented now.

## 1) Runtime Overview

Skill Garden runs as a browser-local application with three app modes:

- Menu mode
- Builder mode
- Viewer mode

Mode and shell selection are route/query driven through `appMode` and `builderShell`.

Primary entry points:

- `src/main.ts` handles app bootstrap, mode routing, and mode-specific UI/runtime initialization.
- `src/appMode.ts` resolves route state (`menu | builder | viewer`) and builder shell mode (`v1 | v2`).

## 2) Menu / Builder / Viewer Separation

### Menu

Purpose:

- Project entry point and navigation hub.
- Lists saved worlds.
- Supports opening JSON and SGW files directly into viewer mode.

Key behavior:

- Creates viewer drafts from imported JSON/SGW so viewer can open immediately.
- Starts menu background runtime and displays persistence notices.

Main modules:

- `src/main.ts`
- `src/ui/menuPanel.ts`
- `src/menu/menuBackgroundRuntime.ts`

### Builder

Purpose:

- Authoring and editing world layouts.

Key behavior:

- Uses the scene builder runtime for placement/editing tools.
- Saves world layouts to local saved-world storage.
- Supports JSON and SGW export/import workflows via builder tools.

Main modules:

- `src/builder/sceneBuilder.ts`
- `src/builder/sceneBuilderState.ts`
- `src/builder/sceneLayoutSerializer.ts`
- `src/ui/builderPanel.ts` (legacy UI path)
- `src/ui/builderPanelV2.tsx` (v2 shell path)

### Viewer

Purpose:

- Read-only world presentation.

Key behavior:

- Resolves world from saved-world source or viewer-draft source.
- Loads scene layout and reports object load/skip diagnostics.
- Uses presentation camera behavior with route resolution and fallback logic.

Main modules:

- `src/viewer/bootstrapViewerMode.ts`
- `src/viewer/resolveViewerWorld.ts`
- `src/engine/createLayoutScene.ts`

## 3) Shell Architecture (Legacy and Transitional)

Builder shell selection:

- `builderShell=v1`: legacy imperative panel UI path.
- `builderShell=v2`: React + Zustand shell path (current target direction).

Current state:

- Both shell paths are live and selectable.
- Both paths use the same underlying scene builder runtime.
- The v2 shell is an active migration direction, not yet a full removal of v1.

Core v2 shell modules:

- `src/editor-shell/BuilderShellApp.tsx`
- `src/editor-shell/builderShellStore.ts`
- `src/editor-shell/sceneBuilderAdapter.ts`

## 4) Scene Runtime Layers

The runtime is layered as:

1. Engine/bootstrap layer
   - Engine init and renderer fallback behavior.
   - Module: `src/engine/initEngine.ts`

2. Scene construction layer
   - Builds interactive builder scenes and read-only viewer scenes.
   - Module: `src/engine/createLayoutScene.ts`

3. Mode orchestration layer
   - Chooses menu/builder/viewer behavior and links UI controls.
   - Module: `src/main.ts`

4. UI shell layer
   - Legacy UI panels and v2 React shell.
   - Modules: `src/ui/*`, `src/editor-shell/*`

## 5) Camera Route Architecture (Practical)

Worlds can carry camera-route metadata.

Route model includes:

- route id and name
- loop flag
- timing mode (`duration` or `speed`)
- easing (`linear` or `easeInOutSine`)
- points with optional per-point dwell time

Runtime route behavior:

- Viewer first tries playable world-metadata routes.
- If none are available, viewer falls back to profile-based cinematic routes.
- Route playback handles move/dwell phases and looping.

Main modules:

- `src/camera-routes/cameraRouteTypes.ts`
- `src/camera-routes/cameraRouteRegistry.ts`
- `src/camera-routes/cameraRoutePlayer.ts`
- `src/camera-routes/routes/viewerRoutes.ts`
- `src/camera-routes/routes/menuRoutes.ts`

## 6) Legacy vs Transitional vs Target

| State | Meaning | Current examples |
| --- | --- | --- |
| Legacy | Supported for compatibility, not strategic direction | `builderShell=v1`, legacy panel-driven builder UI path |
| Transitional | Live coexistence while migration is underway | v1 and v2 shell paths both available in current runtime |
| Target | Intended direction of the project | React + Zustand builder shell over shared scene runtime |

## 7) Scope Notes

This document covers architecture and current runtime state only.

Out of scope here:

- detailed testing workflow
- CI policy details
- deployment runbook

Those are handled in later documentation phases.
