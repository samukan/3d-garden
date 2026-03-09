---
applyTo: "src/ui/**,src/**/*.css,src/**/*.scss,src/**/*.html,src/main.ts,index.html"
---

# UI instructions

## Priority
Optimize for readability, clarity, and low-friction interaction.

## Rules
- UI should support the 3D scene, not compete with it
- Keep overlays simple, readable, and recruiter-friendly
- Prefer small iterative UI changes over large rewrites
- Avoid fixed sizing that breaks on laptop screens
- Prefer clean spacing and hierarchy over decorative complexity

## Overlay requirements
A selected project overlay should make these easy to read:
- title
- summary
- year
- technologies
- relevant links

## Styling
- Maintain good contrast
- Avoid overly small text
- Prevent text overflow
- Prefer lightweight CSS over UI framework complexity
- Use consistent spacing and typography

## Interaction
- Hover states should be visible but not distracting
- Click behavior should feel obvious
- Close/back behavior for overlays should be simple
- Do not hide important information behind unnecessary interactions

## Responsiveness
- UI should remain usable on common laptop screens
- Avoid layouts that depend on very large monitors
- Keep overlay and status elements from covering critical scene content

## Debugging
When fixing UI bugs:
- Check overflow first
- Check contrast and readability next
- Check z-index and pointer interaction issues
- Do not refactor unrelated rendering code while fixing UI