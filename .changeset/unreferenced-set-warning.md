---
"@vertekum/core": patch
---

`vertekum check` now warns (`resolver/unreferenced-set`) when a token set is referenced by no composition — its tokens were validated but reached no output. Flat projects (no resolvers) are unaffected.
