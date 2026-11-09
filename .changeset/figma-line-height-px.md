---
"@vertekum/ext-export-figma": minor
---

A line-height token referenced by text styles is exported as a px variable (the style's font size × the multiplier, per mode, rounded to 2 decimals), and the text style binds its line height to it, so a style whose compositions differ in line height stays shared. The Figma model is contract `draft.06`.
