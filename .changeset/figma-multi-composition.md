---
"@vertekum/core": minor
"@vertekum/ext-export-figma": minor
---

A figma target may name several `compositions`, merged into one `figma.model.json`: collections that resolve identically are untouched, ones that differ gain a mode per composition, and moded collections take the (composition, context) pairs that exist. The model records `source.target`, `source.compositions` and per-collection `modeSources`; the contract is now `draft.02`.
