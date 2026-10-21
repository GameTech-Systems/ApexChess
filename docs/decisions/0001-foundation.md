# 0001: Foundation choices

Date: 2026-10-20 · Status: accepted (license provisional, D10)

## Decisions

- **License:** code, rules text, and rule data are source-available under PolyForm Shield 1.0.0. Contributions need the CLA; every commit carries a DCO sign-off. Name, logos, and art are reserved. *(Provisional, D10.)*
- **Merging:** Claude opens and merges its own pull requests after the `ci` check passes. The `main` ruleset requires a pull request and the `ci` check, allows rebase merges only, and blocks force-pushes and deletion.
- **Model default:** Sonnet 5.5 pinned in `.claude/settings.json`; Opus 5.5 for steps the build plan marks Opus.
- **Zip uploads:** the owner can upload a zip; `.github/workflows/unpack-zip.yml` unpacks it and, on a branch, runs CI and turns on auto-merge.
- **Geometry:** positions use standard a1 to h8 coordinates; the 45° turn is a rendering concern.

## Why

The same setup already works for the owner's other game repository, and keeping it identical means one way of working across both projects.
