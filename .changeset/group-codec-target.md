---
"@vertekum/core": patch
---

A group codec's context gains `target(value)`: the path of the token at the end of an alias chain, when a value-position JSON Pointer can address it — so a generated token can borrow part of another token's value instead of copying it.
