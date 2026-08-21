# @vertekum/schema-atlassian

## 0.1.2

### Patch Changes

- [`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9) Thanks [@tschemmer](https://github.com/tschemmer)! - The space vocabulary is declared with zero-padded scale ranges (`025-100/25 | 150-300/50 | 400-600/100`) instead of a hand-list; granted names are unchanged.

## 0.1.1

### Patch Changes

- [`c8d9ce6`](https://github.com/moros-oxus/vertekum/commit/c8d9ce6040283afacd343e1d924cf31cff696eda) Thanks [@tschemmer](https://github.com/tschemmer)! - The vocabulary schemas are now built from grammar definition modules shipped beside them (`dfn/` in, `lib/` out); artifacts carry provenance stamps, and every import path is unchanged and flat (`@vertekum/schema-atlassian/color.json`, `…/color.dfn`).
