---
"@vertekum/ext-export-figma": minor
---

A merged Figma model no longer leaves a composition's modes blank for a variable that composition lacks: they alias a typed "not available" sentinel (`NOT_AVAILABLE/COLOR` in magenta, `/FLOAT`, `/STRING`, `/BOOLEAN`) in its own collection, named in `source.notAvailable` — a visible marker in the design tool and a signal for write-back. The contract is now `draft.04`.
