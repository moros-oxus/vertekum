---
"@vertekum/ext-export-figma": patch
---

A text style member that references a token whose own value is a reference (`"{font.weight.bold}"`) is now bound to that token's variable, so the style is no longer split per composition, and a font size referencing a dimension token now names its variable.
