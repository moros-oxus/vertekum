# @vertekum/cli

## 0.3.7

### Patch Changes

- [`f72a0a9`](https://github.com/moros-oxus/vertekum/commit/f72a0a9a01b9fa24c535aa3ad8c2259f77676c9c) Thanks [@tschemmer](https://github.com/tschemmer)! - Schema `match` grows brace alternation in the glob (`colors-{light,black}.json` — standard comma convention, everywhere globs are matched) and accepts an array of patterns (a file matches when any does).
- Updated dependencies [[`f72a0a9`](https://github.com/moros-oxus/vertekum/commit/f72a0a9a01b9fa24c535aa3ad8c2259f77676c9c)]:
  - @vertekum/core@0.3.7
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.6

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.6
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.5

### Patch Changes

- [`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a) Thanks [@tschemmer](https://github.com/tschemmer)! - Collection files may live in subdirectories — directories are purely organizational. A set's name is its collection-relative path (`brands/brand-a`); reading walks recursively, writing creates and cleans up directories, schema `match` globs the relative path, and `vtk resolver -s` paths re-join the tail as the set name (resolutionOrder refs RFC 6901-escape nested names, tolerantly read either way).
- Updated dependencies [[`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a)]:
  - @vertekum/core@0.3.5
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.4

### Patch Changes

- [`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec) Thanks [@tschemmer](https://github.com/tschemmer)! - Group codecs — one payload, many tokens: a leaf group carrying a registered codec key expands into generated child tokens (views with mutation refusal, exported via interchange; alias-resolving payloads). `ValidationInput` gains the raw collection `files` for validators whose subject is group data. First release of `@vertekum/ext-token-ramp`: colour ramps from a single brand anchor — fixed lightness ladder, chroma arched through the anchor in OKLCH, virtual (generated) and committed (`vertekum ramp build [--check]`) modes.
- Updated dependencies [[`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec)]:
  - @vertekum/core@0.3.4
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.3

### Patch Changes

- [`9cff445`](https://github.com/moros-oxus/vertekum/commit/9cff4459526a0900295b4c8f1f90460fe753b77f) Thanks [@tschemmer](https://github.com/tschemmer)! - A relative `--cwd` no longer breaks config loading (`ERR_INVALID_MODULE_SPECIFIER`): the working directory is absolutized before discovery and the config is imported by file URL, which also makes loading correct on Windows.
- Updated dependencies []:
  - vertekum@0.3.0
  - @vertekum/core@0.3.3
  - @vertekum/server@0.3.0

## 0.3.2

### Patch Changes

- [`b591cb5`](https://github.com/moros-oxus/vertekum/commit/b591cb59351c937c0405601eeeee89e33a418fa7) Thanks [@tschemmer](https://github.com/tschemmer)! - Extending the DTCG schema: patch documents (top-level `$extends` mapping `dtcg#` anchors to additive deltas) declare custom and compound types — tokens carry them directly in `$type`/`$value`, validated by the patched effective schema. Anchors derive from the binding in effect; bindings assemble across config and extension routes with last-wins `id` replacement and origins in `describe`. Extensions can also register token codecs (`'token-codec'` service) that materialize `$extensions`-carried generative payloads into ordinary tokens, and schema bindings (`'schema-bindings'` service) without a config entry.

- [`83f296c`](https://github.com/moros-oxus/vertekum/commit/83f296c742bd7b5be22f509b4430829b4032605c) Thanks [@tschemmer](https://github.com/tschemmer)! - Resolver curation verbs: `vtk resolver add/remove/push/pop/order/default/list` edit compositions from the command line — generic verbs over an address path (`-s [resolver/]set`, `-m [resolver/]modifier[/context]`), with single-resolver elision, creation confined to `add`, and closest-name suggestions on every refusal. `vtk` joins `vertekum` as a bin alias.
- Updated dependencies [[`b591cb5`](https://github.com/moros-oxus/vertekum/commit/b591cb59351c937c0405601eeeee89e33a418fa7), [`83f296c`](https://github.com/moros-oxus/vertekum/commit/83f296c742bd7b5be22f509b4430829b4032605c), [`44122ed`](https://github.com/moros-oxus/vertekum/commit/44122ed8327c4d39b55c8c45d194f423fed96289)]:
  - @vertekum/core@0.3.2
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.1
  - vertekum@0.3.0
  - @vertekum/server@0.3.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`84172d2`](https://github.com/moros-oxus/vertekum/commit/84172d2ca90320b60ec4c42730a69c056631a81c)]:
  - @vertekum/core@0.3.0
  - vertekum@0.1.0
  - @vertekum/server@0.1.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9)]:
  - @vertekum/core@0.1.2
  - vertekum@0.1.0
  - @vertekum/server@0.1.0

## 0.1.1

### Patch Changes

- [`6f843f3`](https://github.com/moros-oxus/vertekum/commit/6f843f38d95059910b94057df55e8e553a7d4bc9) Thanks [@tschemmer](https://github.com/tschemmer)! - `vertekum init` now scaffolds a grouped agent-skill set (`.claude/skills/vertekum/…` — a tokens skill covering the full verb, schema, and value-notation surface, plus a release-workflow skill), and `init --skill` refreshes the skills alone without touching the config; skills you have edited (stamp line removed) are never overwritten.

- [`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86) Thanks [@tschemmer](https://github.com/tschemmer)! - Contributed CLI commands can now declare file artifacts on their `CommandResult` (`files`); the runner writes them, keeps `--dry-run` and `--json` faithful, and refuses paths outside the working directory.
- Updated dependencies [[`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86)]:
  - @vertekum/core@0.1.1
  - vertekum@0.1.0
  - @vertekum/server@0.1.0
