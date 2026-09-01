---
"@vertekum/ext-token-ramp": patch
---

Multi-brand ramp physics: settings gain `profiles` (named partials — a brand's ladder, a tweaked curve) and `defaultProfile`; a ramp payload selects one with `profile`. Resolution is per field through defaults ← settings ← profile ← payload, ladders merging by step key; an unknown profile is `ramp/unknown-profile`, never a silent fallback.
