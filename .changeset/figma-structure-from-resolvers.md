---
"@vertekum/ext-export-figma": minor
---

The Figma model's structure now comes from the resolvers' files, never from values: a modifier's collection holds every path its contexts' files define, several compositions share a collection exactly when they draw it from the same files, and a value edit no longer moves variables or modes. `$root` never reaches a variable name, each variable records per-mode `sources`, and `source.fingerprint` hashes the model's content; the contract is now `draft.03`.
