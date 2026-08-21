# @vertekum/schema-builder

## 0.1.5

### Patch Changes

- [`ecb2e95`](https://github.com/moros-oxus/vertekum/commit/ecb2e95fa860fa1aed780b29222aa69d474d68fe) Thanks [@tschemmer](https://github.com/tschemmer)! - Adds `vertekum schema lint`: validate `.dfn` modules — fragments and unused productions included — with findings collected and positioned per file. Grammar errors now point at the offending source (file, line, column) instead of `1:1`, and a misplaced `*` explains where the open-set mark belongs.

## 0.1.4

### Patch Changes

- [`6932b20`](https://github.com/moros-oxus/vertekum/commit/6932b20cd3c4e133de5c465bacea5dd1fada2d06) Thanks [@tschemmer](https://github.com/tschemmer)! - Imports can be aliased — `use "./palette/color.dfn" as palette` — making `<@palette>` the module's root and `<@palette/name>` a qualified reference, which resolves same-basename imports (the duplicate-import error now suggests it). Provenance stamps record a caller-supplied module label (the CLI passes the project-relative path), so nested same-named modules stamp distinguishably; `buildModule` accepts the label as its second argument.

- [`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9) Thanks [@tschemmer](https://github.com/tschemmer)! - Range terms grow into scale expressions: a leading zero on a written endpoint zero-pads every emitted name (`025-100/25` → `025 050 075 100`), `min-max*factor` declares a geometric scale (fractional factors allowed), and `~quantum` rounds each step to the nearest multiple (`16-64*1.25~4` → `16 20 24 32 40 48 60`). Steps that quantize onto an earlier name are a build error.
- Updated dependencies [[`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9)]:
  - @vertekum/core@0.1.2

## 0.1.3

### Patch Changes

- [`67ef6d9`](https://github.com/moros-oxus/vertekum/commit/67ef6d96ad209072df270adccaa7ee879edbc30e) Thanks [@tschemmer](https://github.com/tschemmer)! - The package now ships a TextMate grammar and language configuration for `.dfn` files under `grammar/` — the single source editor integrations and documentation highlighters (e.g. Shiki) consume.

## 0.1.2

### Patch Changes

- [`579276d`](https://github.com/moros-oxus/vertekum/commit/579276d8c1ab7215f291037cebcad0e03ae8d170) Thanks [@tschemmer](https://github.com/tschemmer)! - `schema build` with no argument now skips fragment modules (files declaring no `root` — imports, noted in the summary) instead of failing; naming one explicitly is still an error. References gain a qualified form, `<@module/production>`, addressing one import's production by module basename — the resolver for name collisions across imports, which the ambiguity error now suggests.

## 0.1.1

### Patch Changes

- Updated dependencies [[`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86)]:
  - @vertekum/core@0.1.1
