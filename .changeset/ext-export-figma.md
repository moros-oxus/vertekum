---
"@vertekum/ext-export-figma": patch
---

New extension: the `figma` exporter resolves a composition into a Figma-shaped model — each resolver set a single-mode collection, each modifier a collection whose contexts are its modes; references as alias edges; typography and shadows as styles with member-variable bindings; every variable carrying both the Figma-typed value and the verbatim DTCG source. Emitted as a versioned `figma.model.json` (JSON Schema shipped), with pluggable dialect writers in target options (`FigmaDialect` — pure model-to-files functions contributed as packages, the terrazzo-plugin pattern). Custom types plug in via `options.types` contributors.
