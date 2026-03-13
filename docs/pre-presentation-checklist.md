# Pre-Presentation Checklist

## 1) Code and Build Checks

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npm run debug:browser`
- Confirm no new errors in terminal output

## 2) Browser Manual Checks

- Open app in a clean browser profile
- Confirm menu loads with no saved worlds
- Create a new world in builder mode
- Place at least one object and save world
- Open saved world in viewer mode
- Return to builder mode from viewer mode
- Download world JSON and upload it back in builder mode
- Use "Open JSON In Viewer" from the menu

## 3) Presentation World File Checks

- Open `skill-garden-eka-maailma-2026-03-13T04-54-33-713Z.json`
- Confirm it opens and diagnostics are understandable
- Verify reviewer-facing note explains potential missing uploaded assets
- Open `skill-garden-reviewer-safe-world-v1-2026-03-13.json`
- Confirm viewer reaches ready state without missing-asset issues

## 4) Documentation Checks

- README includes project overview, stack, local run, and test instructions
- README includes Vercel placeholder link text
- README includes "What I learned" with explicit note that many parts were new
- README includes known limitations and next steps
- README explains local-first storage boundaries and portability caveats

## 5) Deployment Checks (Vercel)

- Confirm install command is `npm ci`
- Confirm build command is `npm run build`
- Confirm output directory is `dist`
- Deploy preview succeeds
- App boots correctly on `/`
- Query mode works: `?appMode=menu`
- Query mode works: `?appMode=builder`
- Query mode works: `?appMode=viewer`

## 6) Live Smoke Expectations

- Menu, builder, and viewer are all reachable
- Save/load flow works in deployed environment
- Built-in assets load and render correctly
- Uploaded assets are clearly understood as local-only data

## 7) Final Presentation Rehearsal

- Practice a full 3-5 minute walkthrough
- Cover project overview and goals
- Show builder demo
- Show viewer demo
- Show JSON workflow demo
- End with known limitations and roadmap
