---
"@vertekum/ext-token-ramp": minor
---

A ramp whose anchor is authored as a reference (`"anchor": "{brand.accent}"`) now keeps that reference on the anchor's step, so the step is an alias to the named colour in every output — a `var()` in CSS, an alias in a Figma model — instead of a copy of its value. The colours are unchanged; an anchor written as a colour is still carried verbatim. Committed ramps built before this report stale under `ramp build --check` until rebuilt.
