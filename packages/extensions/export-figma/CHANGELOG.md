# @vertekum/ext-export-figma

## 0.3.15

### Patch Changes

- [`b1819c0`](https://github.com/moros-oxus/vertekum/commit/b1819c0f31411bf73a4fe9854b90ee73f8e3e36d) Thanks [@tschemmer](https://github.com/tschemmer)! - New extension: the `figma` exporter resolves a composition into a Figma-shaped model — each resolver set a single-mode collection, each modifier a collection whose contexts are its modes; references as alias edges; typography and shadows as styles with member-variable bindings; every variable carrying both the Figma-typed value and the verbatim DTCG source. Emitted as a versioned `figma.model.json` (JSON Schema shipped), with pluggable dialect writers in target options (`FigmaDialect` — pure model-to-files functions contributed as packages, the terrazzo-plugin pattern). Custom types plug in via `options.types` contributors.
- Updated dependencies []:
  - @vertekum/core@0.3.15
