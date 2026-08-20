---
"@vertekum/schema-builder": patch
---

`schema build` with no argument now skips fragment modules (files declaring no `root` — imports, noted in the summary) instead of failing; naming one explicitly is still an error. References gain a qualified form, `<@module/production>`, addressing one import's production by module basename — the resolver for name collisions across imports, which the ambiguity error now suggests.
