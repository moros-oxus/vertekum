# @vertekum/core

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
