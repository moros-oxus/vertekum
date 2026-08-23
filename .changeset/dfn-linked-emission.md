---
"@vertekum/schema-builder": patch
---

Linked emission (`schemaBuilderExtension({ link: true })`): an unmodified `<@module>` root embedding emits a `$ref` into the child module's own artifact — `"color": { "$ref": "./primitives/color.json#/properties/color" }` — instead of inlining a duplicate. Property keys stay local so sealing is unchanged; modified, open, tailed, and production references still inline, as do modules the project does not build. Default remains self-contained artifacts.
