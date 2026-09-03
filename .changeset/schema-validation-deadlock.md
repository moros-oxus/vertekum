---
"@vertekum/core": patch
"@vertekum/schema-builder": patch
---

A configured schema that compiles but crashes during validation (a ref cycle, a validator too large for the stack) now surfaces as a `schema/invalid-schema` diagnostic naming the binding and file instead of taking every command down — so `schema build` can always regenerate a broken artifact. The builder's emit dedupe also hoists subtrees repeated as a single shared object reference, which previously escaped structural sharing entirely.
