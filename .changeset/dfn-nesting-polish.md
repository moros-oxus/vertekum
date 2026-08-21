---
"@vertekum/schema-builder": patch
---

Imports can be aliased — `use "./palette/color.dfn" as palette` — making `<@palette>` the module's root and `<@palette/name>` a qualified reference, which resolves same-basename imports (the duplicate-import error now suggests it). Provenance stamps record a caller-supplied module label (the CLI passes the project-relative path), so nested same-named modules stamp distinguishably; `buildModule` accepts the label as its second argument.
