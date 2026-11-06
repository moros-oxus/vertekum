---
"@vertekum/ext-export-figma": minor
---

A merged model no longer splits a text style per composition when its compositions differ only in members the style binds (font family, size, weight, px letter spacing): the style is emitted once, unprefixed, and follows the design file's mode. A style member names `variable` only when that variable exists in the model.
