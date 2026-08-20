# @vertekum/schema-builder

## 0.1.2

### Patch Changes

- [`579276d`](https://github.com/moros-oxus/vertekum/commit/579276d8c1ab7215f291037cebcad0e03ae8d170) Thanks [@tschemmer](https://github.com/tschemmer)! - `schema build` with no argument now skips fragment modules (files declaring no `root` — imports, noted in the summary) instead of failing; naming one explicitly is still an error. References gain a qualified form, `<@module/production>`, addressing one import's production by module basename — the resolver for name collisions across imports, which the ambiguity error now suggests.

## 0.1.1

### Patch Changes

- Updated dependencies [[`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86)]:
  - @vertekum/core@0.1.1
