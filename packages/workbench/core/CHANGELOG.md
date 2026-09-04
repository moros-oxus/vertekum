# @vertekum/core

## 0.3.15

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.15

## 0.3.14

### Patch Changes

- [`0649de6`](https://github.com/moros-oxus/vertekum/commit/0649de64a8eeec61a64a03a982b622cd5addec17) Thanks [@tschemmer](https://github.com/tschemmer)! - A reference is now exactly one curly alias — a multi-brace string like `{a} {b}` is a plain value (typically shorthand for the command extension chain), never a single reference, so pure-reference shorthands reach `token add`/`token set` chain links instead of being swallowed. The kernel also seeds the exporter registry before extensions activate, retiring the get-or-create ritual: an exporter extension just get()s `EXPORTER_SERVICE` and registers, and `build` reports "no exporters registered" when the registry is empty.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.14

## 0.3.13

### Patch Changes

- [`def7e25`](https://github.com/moros-oxus/vertekum/commit/def7e25d2a77f892b233f4b2c6fce4705d4f2a19) Thanks [@tschemmer](https://github.com/tschemmer)! - The command extension chain: `ctx.commands.extend(name, link)` joins the chain of an existing command. Links on `token add`/`token set` prepare values before the built-in transforms — parse a custom type's short form, infer a type from the tree and the value's shape, or refuse with the accepted forms — with an explicit `--type` always beating a proposal. Links on `build` present tokens at interchange, so a custom type reaches every exporter in a form the downstream tool renders. Links propose and never write; order follows the config's `extensions` array; options a link declares join the command's flag set.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.13

## 0.3.12

### Patch Changes

- [`bcb1f46`](https://github.com/moros-oxus/vertekum/commit/bcb1f46b9491f24560d88d7a1b416bd13dd553a4) Thanks [@tschemmer](https://github.com/tschemmer)! - A configured schema that compiles but crashes during validation (a ref cycle, a validator too large for the stack) now surfaces as a `schema/invalid-schema` diagnostic naming the binding and file instead of taking every command down — so `schema build` can always regenerate a broken artifact. The builder's emit dedupe also hoists subtrees repeated as a single shared object reference, which previously escaped structural sharing entirely.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.12

## 0.3.11

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.11

## 0.3.10

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.10

## 0.3.9

### Patch Changes

- [`a35485a`](https://github.com/moros-oxus/vertekum/commit/a35485a227a9e94271b041bc020f8edf28e0137b) Thanks [@tschemmer](https://github.com/tschemmer)! - A group codec's carrier may hold a `$root` token — the root parses as the group's own value and the generated children appear beside it (previously such a group silently generated nothing). `ramp build` now emits every computed stop as `data.ramps` under `--json`, making `--dry-run --json` a first-class value source.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.9

## 0.3.8

### Patch Changes

- [`18e8a1f`](https://github.com/moros-oxus/vertekum/commit/18e8a1fd3343e7dc530188d0b6f094d1dbf92e06) Thanks [@tschemmer](https://github.com/tschemmer)! - `{group}` references resolve to the group's `$root` token, as the spec intends — `$root` never appears in a reference (the format schema forbids `$` segments), exactly as it never appears in an exported name. Previously a `$root` token could not be legally referenced at all.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.8

## 0.3.7

### Patch Changes

- [`f72a0a9`](https://github.com/moros-oxus/vertekum/commit/f72a0a9a01b9fa24c535aa3ad8c2259f77676c9c) Thanks [@tschemmer](https://github.com/tschemmer)! - Schema `match` grows brace alternation in the glob (`colors-{light,black}.json` — standard comma convention, everywhere globs are matched) and accepts an array of patterns (a file matches when any does).
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.7

## 0.3.6

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.6

## 0.3.5

### Patch Changes

- [`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a) Thanks [@tschemmer](https://github.com/tschemmer)! - Collection files may live in subdirectories — directories are purely organizational. A set's name is its collection-relative path (`brands/brand-a`); reading walks recursively, writing creates and cleans up directories, schema `match` globs the relative path, and `vtk resolver -s` paths re-join the tail as the set name (resolutionOrder refs RFC 6901-escape nested names, tolerantly read either way).
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.5

## 0.3.4

### Patch Changes

- [`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec) Thanks [@tschemmer](https://github.com/tschemmer)! - Group codecs — one payload, many tokens: a leaf group carrying a registered codec key expands into generated child tokens (views with mutation refusal, exported via interchange; alias-resolving payloads). `ValidationInput` gains the raw collection `files` for validators whose subject is group data. First release of `@vertekum/ext-token-ramp`: colour ramps from a single brand anchor — fixed lightness ladder, chroma arched through the anchor in OKLCH, virtual (generated) and committed (`vertekum ramp build [--check]`) modes.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.3

## 0.3.2

### Patch Changes

- [`b591cb5`](https://github.com/moros-oxus/vertekum/commit/b591cb59351c937c0405601eeeee89e33a418fa7) Thanks [@tschemmer](https://github.com/tschemmer)! - Extending the DTCG schema: patch documents (top-level `$extends` mapping `dtcg#` anchors to additive deltas) declare custom and compound types — tokens carry them directly in `$type`/`$value`, validated by the patched effective schema. Anchors derive from the binding in effect; bindings assemble across config and extension routes with last-wins `id` replacement and origins in `describe`. Extensions can also register token codecs (`'token-codec'` service) that materialize `$extensions`-carried generative payloads into ordinary tokens, and schema bindings (`'schema-bindings'` service) without a config entry.

- [`83f296c`](https://github.com/moros-oxus/vertekum/commit/83f296c742bd7b5be22f509b4430829b4032605c) Thanks [@tschemmer](https://github.com/tschemmer)! - Resolver curation verbs: `vtk resolver add/remove/push/pop/order/default/list` edit compositions from the command line — generic verbs over an address path (`-s [resolver/]set`, `-m [resolver/]modifier[/context]`), with single-resolver elision, creation confined to `add`, and closest-name suggestions on every refusal. `vtk` joins `vertekum` as a bin alias.

- [`44122ed`](https://github.com/moros-oxus/vertekum/commit/44122ed8327c4d39b55c8c45d194f423fed96289) Thanks [@tschemmer](https://github.com/tschemmer)! - `vertekum check` now warns (`resolver/unreferenced-set`) when a token set is referenced by no composition — its tokens were validated but reached no output. Flat projects (no resolvers) are unaffected.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.1

## 0.3.0

### Minor Changes

- The coordinated wave: every published package moves in lockstep from here (core additionally gains affixed scale names — `evaluateScale` prefix/suffix).

### Patch Changes

- [`84172d2`](https://github.com/moros-oxus/vertekum/commit/84172d2ca90320b60ec4c42730a69c056631a81c) Thanks [@tschemmer](https://github.com/tschemmer)! - Affixed scales: a parenthesized formula may carry word fragments on either or both ends — `(2-4)xs` → `2xs 3xs 4xs`, `xs(2-4)`, `x(2-8/2)s` — with the full formula grammar (geometric ratios, quantization, zero-pad) available inside the parentheses. `evaluateScale` gains optional `prefix`/`suffix`; affixes wrap the names while values stay numeric. The additive step is now optional: `2-4` means `2-4/1`.
- Updated dependencies []:
  - @vertekum/schema-dtcg@0.3.0

## 0.1.2

### Patch Changes

- [`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9) Thanks [@tschemmer](https://github.com/tschemmer)! - Adds `evaluateScale` — the shared authority for generating a scale's names and values: stepped and multiplied (geometric) forms, fractional factors, quantization to a nearest multiple, zero-padded names, and reported collisions.

## 0.1.1

### Patch Changes

- [`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86) Thanks [@tschemmer](https://github.com/tschemmer)! - Contributed CLI commands can now declare file artifacts on their `CommandResult` (`files`); the runner writes them, keeps `--dry-run` and `--json` faithful, and refuses paths outside the working directory.
