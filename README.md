# Skill Garden

Skill Garden is a local-first 3D world builder and viewer built with Babylon.js, TypeScript, and Vite.
The project currently supports end-to-end browser workflows for building worlds, saving/loading locally, importing/exporting layouts, packaging portable worlds, and presenting worlds in a read-only viewer.

## Current Project Direction

Skill Garden is currently in a **transitional architecture phase**:

- Core builder/viewer scene runtime is stable and actively used.
- A legacy builder UI path still exists.
- A newer React + Zustand builder shell path exists behind a shell mode flag and represents the current/final direction.

v1-era behavior is still supported where needed, but it is **not** the long-term primary direction.

## What Works Today

- Main Menu -> Builder -> Save -> Viewer roundtrip.
- Menu workflows for opening worlds from local saved data.
- Builder workflows for placing, selecting, transforming, duplicating, and deleting objects.
- Local `.glb` upload and categorization for custom assets.
- JSON layout import/export workflows (legacy format).
- Portable world package import/export via `.sgw`.
- Viewer load diagnostics for missing/unavailable assets.
- Camera-route metadata support for viewer autoplay/fallback presentation routes.
- Playwright browser checks (smoke and e2e coverage under `playwright/`).

## Builder and Viewer Reality

| Mode | Purpose | Current behavior |
| --- | --- | --- |
| Menu | Entry point | Lists saved worlds, opens viewer/builder flows, supports JSON/SGW open-in-viewer flows |
| Builder | Authoring | Scene editing + persistence/export tools; supports legacy UI shell and newer v2 shell mode |
| Viewer | Presentation | Read-only world playback, reset view, diagnostics, camera presentation/autoplay behavior |

Builder shell modes:

- `builderShell=v1`: legacy imperative panel path.
- `builderShell=v2`: React + Zustand shell path (target direction, still transitional).

## Tech Stack

- Rendering/3D: Babylon.js (`@babylonjs/core`, `@babylonjs/loaders`)
- UI direction: React + Zustand (builder shell migration path)
- Build tool: Vite
- Language: TypeScript
- Validation: Zod
- Browser testing: Playwright

## Local-First Data Model

Skill Garden runs without a backend. Data is stored in browser-local stores:

- `localStorage`: saved worlds (`skill-garden.saved-worlds.v1`)
- `sessionStorage`: temporary viewer drafts (`skill-garden.viewer-drafts.v1`)
- `IndexedDB`: uploaded local asset blobs (`skill-garden.uploaded-assets.v1`)

Important implications:

- Data is browser- and origin-specific.
- URL world links depend on matching local data in that same environment.
- Cross-device/environment portability should use `.sgw`, not legacy JSON.

## World Formats: `.json` vs `.sgw`

- `.json` (legacy layout format): stores layout + metadata, but does **not** include uploaded `.glb` binary payloads.
- `.sgw` (recommended portable package): zip package containing world layout plus uploaded asset payloads, designed for portable world transfer.

Practical rule:

- Use `.json` for layout-level workflows and debugging.
- Use `.sgw` when world portability is required.

## Camera Routes (Current)

- Worlds can carry camera-route metadata (multiple routes + optional default route).
- Viewer route resolution prefers world metadata routes when playable.
- If no playable world route exists, viewer falls back to profile-based cinematic routes.

## Project Structure (Short)

- `src/main.ts`: app bootstrap, mode routing, builder/viewer/menu entry behavior
- `src/appMode.ts`: app mode and builder shell route parsing
- `src/builder`: scene builder runtime and layout serialization
- `src/viewer`: viewer world resolution and viewer bootstrap
- `src/editor-shell`: React + Zustand builder shell direction
- `src/storage`: saved worlds, viewer drafts, uploaded asset persistence
- `src/world-package`: `.sgw` world package import/export
- `src/camera-routes`: route types, registry, playback behavior
- `playwright`: browser smoke/e2e coverage and debug harness utilities

## Technical Docs

- Runtime and shell architecture: `docs/architecture-current-state.md`
- Storage layers and world formats: `docs/storage-world-formats.md`
- Development and testing quick reference: `docs/development-testing.md`

## Run Locally

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Type check:

```bash
npm run typecheck
```

## Test Locally

Install Playwright browser dependency (one-time per environment):

```bash
npm run playwright:install
```

Run browser debug/test harness:

```bash
npm run debug:browser
```

Run with visible browser:

```bash
npm run debug:browser:headed
```

## Transitional Areas and Known Limitations

- No backend/accounts/cloud sync (local-first by design).
- Builder shell architecture is transitional (`v1` legacy path + `v2` target path).
- Legacy `.json` format is not fully portable for worlds depending on uploaded local assets.
- URL-linked world opening still depends on local data availability in the same browser/origin.
- Performance optimization and load-time improvements are still ongoing.
- WebGPU availability is environment-dependent; runtime falls back to WebGL when needed.

## Near-Term Direction

- Continue moving builder UX toward the React + Zustand shell direction.
- Keep viewer presentation behavior stable while improving diagnostics and route polish.
- Improve portability and demo reliability around world packaging flows.
- Continue iterative performance improvements.

## Asset Attribution

Nature Kit assets are by Kenney and distributed under CC0.
See `public/assets/nature-kit/License.txt`.
