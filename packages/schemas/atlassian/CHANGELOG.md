# @vertekum/schema-atlassian

## 0.3.4

## 0.3.3

## 0.3.2

## 0.3.1

## 0.3.0

### Minor Changes

- [`1faab42`](https://github.com/moros-oxus/vertekum/commit/1faab429acdd5c53565b3975654ce8da05e89bfc) Thanks [@tschemmer](https://github.com/tschemmer)! - The emission model: public productions emit as open `$defs` patterns (sealing belongs to the positions that apply them, composed via `allOf`); `:name` declares a private production — inlined, invisible to importers; the `scope` pragma names the file's nature (`document` | `def` | `inline` — a def file's root also lands as `$defs.<filename>` and rootless files emit defs-only artifacts by default) while `sealed "true" | "false"` takes over the document-top seal (`scope "branch"` parses as a deprecated alias); the empty leaf dedupes into `$defs.terminal`; `schemaId` derives artifact `$id`s from a configured base; linked emission gains `#/$defs/…` pattern refs; lint reports non-failing warnings (open-merge, deprecations). Atlassian artifacts regenerate under the new shape — the granted vocabulary is unchanged.

## 0.1.2

### Patch Changes

- [`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9) Thanks [@tschemmer](https://github.com/tschemmer)! - The space vocabulary is declared with zero-padded scale ranges (`025-100/25 | 150-300/50 | 400-600/100`) instead of a hand-list; granted names are unchanged.

## 0.1.1

### Patch Changes

- [`c8d9ce6`](https://github.com/moros-oxus/vertekum/commit/c8d9ce6040283afacd343e1d924cf31cff696eda) Thanks [@tschemmer](https://github.com/tschemmer)! - The vocabulary schemas are now built from grammar definition modules shipped beside them (`dfn/` in, `lib/` out); artifacts carry provenance stamps, and every import path is unchanged and flat (`@vertekum/schema-atlassian/color.json`, `…/color.dfn`).
