---
applyTo: "**"
---

# General workflow instructions

## Work style
- Start with a short implementation plan for non-trivial tasks
- Then make the smallest meaningful change
- Keep momentum; do not stop at scaffolding only
- Make sensible decisions without asking unnecessary questions

## Scope control
- Stay tightly within the requested task
- Do not introduce unrelated refactors
- Do not add speculative features
- If a change suggests future improvements, mention them briefly instead of implementing them immediately

## Validation workflow
After changes:
- check for obvious TypeScript issues
- verify relevant scripts still make sense
- inspect console errors if the task affects runtime behavior
- visually verify UI changes when applicable

## Reporting back
When done:
- summarize what changed
- mention files changed
- mention any assumptions made
- mention anything intentionally deferred