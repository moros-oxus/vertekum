# @vertekum/core

## 0.2.0

### Minor Changes

- [`82b695e`](https://github.com/moros-oxus/vertekum/commit/82b695e32cf1b7ee37f9d2f2f753aeff8ae3d15f) Thanks [@tschemmer](https://github.com/tschemmer)! - Scale expressions grow affixes: `evaluateScale` takes optional `prefix`/`suffix` that wrap each generated name around the padded digits while values stay numeric — the shared evaluator now covers t-shirt-style scales (`2xs…4xs`) for schema names and, ahead, token-side materialization. (Coordinated 0.2.0 with the dfn language revision.)

### Patch Changes

- [`84172d2`](https://github.com/moros-oxus/vertekum/commit/84172d2ca90320b60ec4c42730a69c056631a81c) Thanks [@tschemmer](https://github.com/tschemmer)! - Affixed scales: a parenthesized formula may carry word fragments on either or both ends — `(2-4)xs` → `2xs 3xs 4xs`, `xs(2-4)`, `x(2-8/2)s` — with the full formula grammar (geometric ratios, quantization, zero-pad) available inside the parentheses. `evaluateScale` gains optional `prefix`/`suffix`; affixes wrap the names while values stay numeric. The additive step is now optional: `2-4` means `2-4/1`.

## 0.1.2

### Patch Changes

- [`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9) Thanks [@tschemmer](https://github.com/tschemmer)! - Adds `evaluateScale` — the shared authority for generating a scale's names and values: stepped and multiplied (geometric) forms, fractional factors, quantization to a nearest multiple, zero-padded names, and reported collisions.

## 0.1.1

### Patch Changes

- [`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86) Thanks [@tschemmer](https://github.com/tschemmer)! - Contributed CLI commands can now declare file artifacts on their `CommandResult` (`files`); the runner writes them, keeps `--dry-run` and `--json` faithful, and refuses paths outside the working directory.
