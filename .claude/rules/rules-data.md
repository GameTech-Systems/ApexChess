---
paths:
  - "rules/**"
---

# Rules data

- Validate every change against `rules/schema/`. Every default must be one of its options.
- Never edit a ruleset whose status is `official`. Create a new version instead (semantic versioning).
- Seed and provisional values say so in `source` or `notes`.
- New parameters, options, pieces, or squares come only from the owner (see `/new-parameter`). Don't add options that nobody asked for.
- A change to a default needs an owner decision. Setup constraints live in each ruleset's `setup.constraints`; setups and presets are data under `rules/setups/` (written for light) and follow the same rules.
- Add each new data file to `packages/engine/src/catalog.ts`.
