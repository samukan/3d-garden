# Skill Garden

Skill Garden is a static web portfolio MVP built with Vite, TypeScript, and Babylon.js. Portfolio data lives in a local JSON file, is validated at runtime, and generates a 3D garden where each project becomes a stylized procedural tree.

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

## Architecture Overview

- `src/main.ts` bootstraps data validation, Babylon engine selection, UI wiring, and the render loop.
- `src/engine` contains renderer initialization, scene creation, and scene state.
- `src/generation` turns portfolio data into biome-aware layout and procedural tree visuals.
- `src/ui` manages plain HTML overlay components: status, quality toggle, and project details.
- `src/types` and `src/utils/validation.ts` define the portfolio schema and runtime validation.
- `src/data/portfolio.json` is the local content source for the garden.

## Garden Rules In The MVP

- `impact` controls tree height.
- `scope` controls trunk thickness.
- `tech.length` increases branch count and foliage density.
- `biomeID` chooses the palette and zone placement.
- `year` influences placement along the garden timeline.

## Renderer Strategy

The app attempts Babylon WebGPU first. If WebGPU is unavailable or initialization fails, it falls back to WebGL automatically. The UI badge shows the active renderer, current FPS, and quality mode.

## Extension Ideas

- Add more biome templates and richer layout rules.
- Add camera bookmarks for featured projects.
- Introduce lightweight ambient animation such as leaf sway or particle pollen.
- Add filtering, timeline controls, or search once the baseline experience is stable.
- Replace placeholder project data with your real portfolio content.

## Intentionally Deferred

- React or any UI framework.
- Search, tagging, or timeline controls.
- Post-processing effects such as bloom.
- External 3D assets, GLTFs, or texture pipelines.
- Backend, CMS, authentication, or deployment automation.
