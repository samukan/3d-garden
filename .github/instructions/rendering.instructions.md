---
applyTo: "src/engine/**,src/generation/**,src/**/*.scene.ts,src/**/*.babylon.ts"
---

# Rendering and scene generation instructions

## Priority
Keep rendering code predictable, modular, and easy to debug.

## Rules
- Keep Babylon engine/bootstrap separate from procedural scene generation
- Prefer small focused functions over large all-in-one scene files
- Isolate setup steps such as camera, lights, ground, fog, and environment
- Reuse materials and geometry where practical
- Prefer deterministic generation for placement and layout where possible
- Avoid scene magic values scattered everywhere; centralize tunable values
- Use clear names for meshes, materials, and scene groups
- Dispose of temporary resources when appropriate

## Performance
- Favor simple geometry for MVP
- Prefer instancing or shared meshes when many similar objects are created
- Avoid unnecessary per-frame work
- Keep render loop logic minimal
- Avoid expensive effects unless explicitly requested

## Compatibility
- WebGPU should be attempted first
- WebGL fallback should remain functional
- Do not make the app depend on WebGPU-only features unless a fallback exists

## Interaction
- Mesh picking and selection logic should stay understandable
- Hover and click behavior should be explicit and traceable
- Camera movement for focus/selection should feel stable and controlled

## Debugging
When fixing rendering issues:
- Look for console errors first
- Check whether the issue is data, mesh generation, material setup, or camera state
- Prefer targeted fixes over refactoring large scene files