---
"@vertekum/ext-token-ramp": minor
---

Ramps can generate a translucent twin series (`color.red.A100` beside `color.red.100`) with the payload's new `alpha` option, in three modes: `solid` (the solid stop at a stepped opacity), `anchor` (the anchor at a stepped opacity), and `match` (the colour that, laid over a background, reproduces the solid stop). Twins that are exactly the anchor's colour borrow it by JSON Pointer. Alpha defaults layer through settings and profiles; `check` reports `ramp/missing-background`, `ramp/unresolved-background` and `ramp/alpha-gamut`. `computeRamp`'s stop type widens to include pointer-linked and RGB-stored stops.
