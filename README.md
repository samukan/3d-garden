# Skill Garden

Skill Garden is a browser-saved 3D world builder built with Vite, TypeScript, and Babylon.js. Worlds are composed in the builder, saved locally in the browser, then reopened either in the editor or in a read-only viewer from the main menu.
The builder also supports explicit world layout JSON download/upload so creators can back up and move worlds outside local browser storage.

## Setup

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` runs TypeScript checks and creates a production bundle.
- `npm run preview` serves the built bundle locally.
- `npm run playwright:install` installs the Chromium browser used by the browser-debug harness.
- `npm run debug:browser` starts Vite through Playwright, opens the app in headless Chromium, and forwards browser console output plus uncaught page errors to the terminal.
- `npm run debug:browser:headed` runs the same browser-debug harness with a visible browser window.

## Browser Debugging

The repo includes a Playwright-based debugging harness for agent-driven troubleshooting, plus a focused set of end-to-end regression checks for core builder flows.

```bash
npm run playwright:install
npm run debug:browser
```

What it does:

- Starts the Vite dev server automatically on `http://127.0.0.1:4173`.
- Runs smoke and stability-focused end-to-end specs (menu, builder, viewer, save/load, persistence recovery, and upload flows).
- Forces `?renderer=webgl` so automated runs do not depend on WebGPU support.
- Prints browser `console.*` output and uncaught page errors into terminal stdout/stderr.
- Fails if startup throws uncaught page errors or key shell UI never appears.

If you want the browser visible while debugging:

```bash
npm run debug:browser:headed
```

App-side debug logs are gated behind `VITE_DEBUG_BROWSER_LOGS=true`, which the Playwright harness sets automatically. That keeps normal dev sessions quiet while still giving the agent useful browser-side bootstrap logs during automated debugging.
You can also enable the same logs manually in a browser session with `?debugBrowserLogs=1`, and you can override the mode manually with `?appMode=menu`, `?appMode=builder`, or `?appMode=viewer`.

## Architecture Overview

- `src/main.ts` bootstraps route handling, Babylon engine selection, UI wiring, and the render loop.
- `src/builder` contains the world editor, selection logic, and layout serialization.
- `src/storage/savedWorldStore.ts` manages browser-local saved worlds.
- `src/engine/createLayoutScene.ts` renders saved builder worlds in read-only mode.
- `src/generation` contains Nature Kit asset loading and manifest data shared by builder and viewer.
- `src/ui` manages plain HTML overlay components such as the menu, builder panels, and renderer status.

## Test Layout

- `playwright/smoke` contains startup smoke checks for menu, builder, and viewer modes.
- `playwright/e2e/world-flows` covers core save/view/edit and import guard flows.
- `playwright/e2e/persistence` covers browser storage recovery behavior.
- `playwright/e2e/assets` covers upload and missing-asset diagnostics.

## Renderer Strategy

The app attempts Babylon WebGPU first. If WebGPU is unavailable or initialization fails, it falls back to WebGL automatically. The UI badge shows the active renderer and current FPS.

## Extension Ideas

- Add more biome templates and richer layout rules.
- Add camera bookmarks for featured projects.
- Introduce lightweight ambient animation such as leaf sway or particle pollen.
- Add filtering, timeline controls, or search once the baseline experience is stable.
- Expand the real portfolio dataset with more projects when needed.

## Intentionally Deferred

- React or any UI framework.
- Search, tagging, or timeline controls.
- Post-processing effects such as bloom.
- Cloud-backed asset libraries and remote texture pipelines.
- Backend, CMS, authentication, or deployment automation.
