---
"@vertekum/ext-token-ramp": minor
---

Generated ramp stops are now mapped into a target gamut instead of storing whatever chroma the arch produced. A new `gamut` setting — `srgb` (default), `display-p3`, or `none` for the previous behaviour — resolves through the usual chain of settings, profile and payload, holding lightness and hue and reducing chroma to the gamut boundary. A stop's `hex` is derived from the mapped colour, so it and `components` no longer describe different colours. The anchor's own step is still carried verbatim and is never mapped.
