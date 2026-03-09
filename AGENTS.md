# AGENTS.md

## Project summary
This repo is a visual 3D portfolio project built with Vite, TypeScript, and Babylon.js.

The concept is a data-driven "Skill Garden" where portfolio projects are represented as procedural 3D elements in a generated scene.

## Main priorities
- Keep the MVP small and working end-to-end
- Prioritize performance and readability
- Prefer simple architecture over clever architecture
- Make the portfolio recruiter-friendly
- Treat visuals as a support for content, not a replacement for content

## Preferred architecture
- `src/engine` = engine bootstrap and renderer setup
- `src/generation` = procedural generation and layout logic
- `src/ui` = overlays, controls, status UI
- `src/data` = local JSON data
- `src/types` = shared TypeScript types
- `src/utils` = validation and shared helpers

If the exact structure changes, preserve the same separation of responsibilities.

## Operating rules
- Propose a short plan before major edits
- Make small, targeted changes
- Do not rewrite unrelated files
- Do not change architecture unless asked
- Explain changed files after editing

## Rendering rules
- Attempt WebGPU first
- Preserve WebGL fallback
- Avoid expensive effects in MVP
- Reuse meshes and materials where practical
- Keep render loop logic minimal

## UI rules
- Keep overlays readable and recruiter-friendly
- Avoid text overflow and weak contrast
- Avoid clutter
- Make important content scannable quickly

## Data rules
- Content should come from local structured data
- Avoid hardcoded portfolio items in scene code
- Keep schema typed and easy to extend
- Prefer deterministic scene generation where useful

## Never do without explicit request
- Introduce React
- Add backend or auth
- Add heavy assets pipeline
- Add bloom or complex post-processing
- Add search/timeline/WASM systems
- Refactor the whole project structure

## Definition of done
A change is considered complete when:
- the requested task is implemented
- no obvious TypeScript/runtime errors remain
- core app behavior still works
- visual changes were checked for readability and breakage
- the result stays within scope

## Good default behavior
If something is unclear:
- choose the simplest robust option
- keep the implementation extendable
- avoid overengineering