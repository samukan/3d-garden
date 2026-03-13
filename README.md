# Skill Garden

Skill Garden is a local-first 3D world builder and viewer built with Babylon.js, Vite, and TypeScript.
This repository contains the first presentable version for course review: a working builder mode, viewer mode, browser-local persistence, and JSON world import/export workflows.

## Project Overview

Skill Garden focuses on editing and presenting lightweight 3D worlds directly in the browser:

- Build worlds in **Builder mode**.
- Save and reopen worlds from the **Main Menu**.
- View worlds in **Viewer mode** (read-only presentation mode).
- Import/export world layouts as JSON files.

This is intentionally a first version: core workflows are working, while cloud and collaboration features are out of scope for now.

## Current Status (v1)

### Working now

- Main Menu -> Builder -> Save -> Viewer roundtrip.
- Browser-local saved worlds.
- JSON download/upload and "Open JSON in Viewer" flow.
- Local `.glb` upload support for custom assets.
- Playwright browser regression checks for core workflows.

### Still early-stage

- No backend, no user accounts, and no cloud synchronization.
- World portability is limited when worlds use uploaded local assets.
- Performance optimization for initial bundle/load is still ongoing.

## Key Features

- Dual app modes: menu, builder, and viewer.
- Asset placement and object editing (move/rotate/scale, duplicate/delete).
- Saved-world management (create, edit, view, delete) in local storage.
- JSON layout workflows through advanced builder tools.
- JSON file download/upload support.
- Open a world JSON directly in viewer mode from the menu.
- Upload and categorize local `.glb` assets.
- Viewer diagnostics for missing/unavailable assets.

## Builder vs Viewer

| Mode | Purpose | What you can do |
| --- | --- | --- |
| Builder | Create and edit worlds | Place assets, transform objects, save worlds, import/export JSON, upload `.glb` assets |
| Viewer | Present worlds in read-only mode | Inspect world content, reset camera view, review load diagnostics |

## Tech Stack

- **Rendering/3D:** Babylon.js (`@babylonjs/core`, `@babylonjs/loaders`)
- **Build tool:** Vite
- **Language:** TypeScript
- **Validation:** Zod
- **Browser testing:** Playwright

## Local-First Data Model

Skill Garden is designed to run without a backend:

- `localStorage`: saved worlds (`skill-garden.saved-worlds.v1`)
- `sessionStorage`: temporary viewer drafts for imported JSON (`skill-garden.viewer-drafts.v1`)
- `IndexedDB`: uploaded local asset blobs (`skill-garden.uploaded-assets.v1`)

Important implication:

- Data is browser- and origin-specific.
- `worldId` / `worldJsonId` URL links are not globally shareable unless matching local data also exists in that exact browser environment.

## Project Structure (Short)

- `src/main.ts`: app bootstrapping and mode routing
- `src/builder`: world editing logic and layout serialization
- `src/viewer`: viewer bootstrapping and world resolution
- `src/storage`: local persistence (saved worlds, viewer drafts, uploaded assets)
- `src/generation`: built-in asset manifest and loading
- `playwright`: smoke and end-to-end browser tests

## Run Locally

```bash
npm install
npm run dev
```

Production build and local preview:

```bash
npm run build
npm run preview
```

## How to Test

Install Playwright browser dependency (one-time per environment):

```bash
npm run playwright:install
```

Run browser smoke/e2e checks:

```bash
npm run debug:browser
```

Optional headed run:

```bash
npm run debug:browser:headed
```

## Presentation World Files

The current presented world file in repo root is:

- file stem: `skill-garden-eka-maailma-2026-03-13T04-54-33-713Z`
- actual file: `skill-garden-eka-maailma-2026-03-13T04-54-33-713Z.json`

Teacher/reviewer can inspect this exact file from the Main Menu using **Open JSON In Viewer**.

Important caveat for this specific file:

- It references mostly uploaded local asset IDs from the original development browser session.
- On a fresh browser/device/deployment, it will still open, but many objects may be skipped because those local uploads are not present.

To provide a reproducible built-in-only example, this repo also includes:

- `skill-garden-reviewer-safe-world-v1-2026-03-13.json`

This reviewer-safe file is designed to render on any fresh environment that has this repo's committed built-in assets.

## Vercel Deployment (First Public Link)

Live demo (placeholder): [Replace with your Vercel URL](https://your-vercel-project-url.vercel.app)

Expected Vercel build settings for this repo:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

Notes:

- App mode routing is query-param based (`?appMode=menu|builder|viewer`), so root static hosting is sufficient.
- Because persistence is local-first, data in one environment (localhost/Vercel preview/Vercel production) does not automatically appear in another.

## What I Learned

Many parts of this project were relatively new to me, and this first version reflects that learning curve.

- Building 3D interaction loops in Babylon.js taught me practical scene setup, camera behavior, and lighting tradeoffs.
- Separating builder and viewer modes helped me design flows by user intent rather than by file/module boundaries.
- Asset handling was more complex than expected: built-in GLBs are straightforward, but uploaded assets require careful browser-storage fallback handling.
- Local-first persistence with validation taught me to treat corrupted/invalid browser data as a normal case and recover safely.
- Building UI in plain TypeScript (without a framework) improved my understanding of event wiring, keyboard ergonomics, and mode-driven state updates.
- Playwright browser tests helped me validate real user flows (save/view/edit/import/export), not just isolated logic.
- Iterating with AI coding agents improved how I plan, verify, and harden changes in small steps.

## Known Limitations

- No backend, accounts, or cloud sync in this version.
- Uploaded assets are local to one browser origin; they are not automatically portable.
- URL-linked worlds depend on local data presence.
- Initial bundle size is still larger than ideal for slower networks/devices.
- WebGPU availability is environment-dependent; the app falls back to WebGL.

## Roadmap / Next Steps

- Add a stronger reviewer/demo world set and optional template worlds.
- Improve portability tooling for worlds that reference uploaded assets.
- Optimize first-load performance and asset loading behavior.
- Expand editor usability and presentation polish.

## Asset Attribution

Nature Kit assets are by Kenney and distributed under CC0.
See `public/assets/nature-kit/License.txt` for included license text.
