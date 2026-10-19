---
"@vertekum/ext-token-ramp": patch
---

`match` alpha twins are stored in oklch like every other ramp stop — still solved in the gamut's RGB space, at a precision that converts back within half a channel step — and a twin with no chroma is written with hue 0 instead of the conversion's noise.
