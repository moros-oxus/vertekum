---
"@vertekum/schema-builder": patch
---

`schema lint`, `schema fmt`, and `schema build` accept a directory argument and sweep it — `.dfn` sources need not live under `./schemas`. A nonexistent path errors up front instead of `1:1 cannot read`.
