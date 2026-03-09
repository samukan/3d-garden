# Project instructions for Copilot

## Project overview
This project is a visual 3D portfolio called "Skill Garden".

The app is a recruiter-friendly, data-driven portfolio where projects are represented as procedural 3D elements in a garden-like scene.

The first version should stay lean, stable, readable, and easy to extend.

## Stack
- Vite
- TypeScript
- Babylon.js
- WebGPU as primary renderer
- WebGL fallback
- Plain HTML/CSS UI unless a stronger reason appears later

## Core goals
- Keep the MVP narrow and working end-to-end
- Prefer procedural geometry over heavy imported assets
- Prioritize readability, performance, and maintainability
- Keep the portfolio useful even without deep 3D interaction experience
- Make visual choices support content, not distract from it

## Architecture preferences
- Keep rendering, scene generation, data parsing, and UI in separate modules
- Keep Babylon-specific logic isolated from generic data logic
- Prefer reusable builders/factories over copy-paste scene code
- Reuse meshes, materials, and instances where sensible
- Avoid hidden side effects across modules
- Do not introduce React unless clearly necessary

## Editing rules
- Make the smallest useful change first
- Avoid rewriting unrelated files
- Preserve current architecture unless explicitly asked to change it
- Before major edits, propose a short plan
- After edits, explain what changed and why
- Do not add features outside the requested scope

## Commands
Use npm.

Common commands:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run lint`

If a script is missing but needed, add it in a minimal and conventional way.

## Performance rules
- Favor simple procedural meshes for the MVP
- Prefer shared materials and mesh reuse
- Use instancing where it clearly helps
- Avoid expensive post-processing in the first version
- Keep scene complexity reasonable for a normal laptop
- Do not add unnecessary animation systems

## UX rules
- The portfolio must not rely only on visual flair
- Selected projects must show readable title, summary, year, tech, and relevant links
- Overlay readability is more important than decorative effects
- Avoid tiny text, overflow, weak contrast, and cluttered layouts
- Recruiters should understand a selected project quickly

## Visual QA workflow
For visual changes:
1. Make a small targeted change
2. Run the app locally
3. Check for console errors
4. Verify layout and readability
5. Verify hover, click, overlay, and camera behavior if affected

If browser inspection tools are available, use them.
If browser tools are unavailable, continue with source-based fixes and ask for a screenshot only when necessary.

## Data rules
- The scene should be generated from local portfolio JSON
- Avoid hardcoding project content directly into scene code
- Keep the data schema simple and practical
- Use TypeScript types for the schema
- Add runtime validation for loaded data where practical
- Prefer deterministic generation when possible

## Non-goals for the current MVP
Do not add these unless explicitly requested:
- React
- Backend or database
- CMS/editor
- WASM/Rust generation
- Bloom or heavy post-processing
- Search/highlight
- Timeline slider
- Complex animation systems
- Deployment automation

## Definition of done
A task is only done when:
- The requested change is implemented
- TypeScript has no obvious errors
- The app still starts locally
- No new console errors were introduced
- Existing core interactions still work
- UI changes were visually checked
- The change stays within scope

## Preferred response style
When working on this repo:
- Be direct
- Explain assumptions briefly
- Keep implementation practical
- Favor robust simple solutions over clever abstractions