---
applyTo: "src/data/**,src/types/**,src/utils/**,src/**/*.schema.ts,src/**/*.types.ts"
---

# Data and schema instructions

## Priority
Keep portfolio data simple, typed, and easy to extend.

## Rules
- Use local JSON as the content source for the MVP
- Define TypeScript types for all portfolio data structures
- Keep schema fields practical and minimal
- Favor explicit field names over overly abstract models
- Avoid mixing raw input data and derived render data without clear separation

## Suggested portfolio item shape
A portfolio item should generally support:
- id
- title
- summary
- year
- impact
- scope
- tech
- biomeID
- links
- featured

This can evolve, but keep it simple.

## Validation
- Add runtime validation where practical
- Fail clearly on invalid data
- Avoid silent schema mismatches
- Keep validation readable and maintainable

## Mapping
When mapping data into the scene:
- Keep transformation logic explicit
- Keep domain data separate from Babylon-specific objects
- Prefer predictable mapping rules over arbitrary visual randomness

## Maintainability
- New portfolio entries should be easy to add without touching scene code
- Keep sample data realistic and useful for UI testing