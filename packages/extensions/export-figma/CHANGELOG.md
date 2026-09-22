# @vertekum/ext-export-figma

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`f5900fe`](https://github.com/moros-oxus/vertekum/commit/f5900fe07b46dfea7cf5e6fd23b2a31e4b8cc512)]:
  - @vertekum/core@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`739344f`](https://github.com/moros-oxus/vertekum/commit/739344ffe4d80a9af1a6d503f2763714be62e8b8)]:
  - @vertekum/core@0.5.0

## 0.4.0

### Minor Changes

- [`2930833`](https://github.com/moros-oxus/vertekum/commit/29308335dafc9d2951722cba37b2c5bf264168ff) Thanks [@tschemmer](https://github.com/tschemmer)! - `figma.model.json` now carries a string contract version (`"version": "draft.01"`) instead of the integer `1`; readers pinned to `1` must accept `draft.01`.

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.4.0

## 0.3.15

### Patch Changes

- [`b1819c0`](https://github.com/moros-oxus/vertekum/commit/b1819c0f31411bf73a4fe9854b90ee73f8e3e36d) Thanks [@tschemmer](https://github.com/tschemmer)! - New extension: the `figma` exporter resolves a composition into a Figma-shaped model — each resolver set a single-mode collection, each modifier a collection whose contexts are its modes; references as alias edges; typography and shadows as styles with member-variable bindings; every variable carrying both the Figma-typed value and the verbatim DTCG source. Emitted as a versioned `figma.model.json` (JSON Schema shipped), with pluggable dialect writers in target options (`FigmaDialect` — pure model-to-files functions contributed as packages, the terrazzo-plugin pattern). Custom types plug in via `options.types` contributors.
- Updated dependencies []:
  - @vertekum/core@0.3.15
