---
"@vertekum/schema-builder": patch
---

The input/output pair is configurable on the extension — `schemaBuilderExtension({ source: './src/dfn', out: './src/schemas' })`. `source` becomes the default sweep for `schema build`, `lint`, and `fmt`; `out` redirects built schemas, mirroring `source`'s directory structure. `schema build` also takes a positional `[out]` for one invocation: a directory argument mirrors into it, a file argument lands directly in it.
