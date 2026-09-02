# @vertekum/schema-builder

## 0.3.11

### Patch Changes

- [`6265f42`](https://github.com/moros-oxus/vertekum/commit/6265f4285ed7b2e9a5e1dd2f6801911ddf9247d0) Thanks [@tschemmer](https://github.com/tschemmer)! - `vertekum schema mock` renders the matrix a vocabulary grants: a grouped name listing (`--style names`), a sample DTCG token file with per-type default values (`--style tokens`; types via the `mock.types` glob map, then `--type`), at `least` (every name adjacency once) or `full` (the whole matrix) coverage — and with `--break <p>`, a separate deliberately-broken sibling file that `check` must refuse. Deterministic at a fixed `--seed`; outputs land in the configured `mock.out`.
- Updated dependencies []:
  - @vertekum/core@0.3.11

## 0.3.10

### Patch Changes

- [`351366b`](https://github.com/moros-oxus/vertekum/commit/351366b8a92c60e9186cb0c74d774000c0d5366c) Thanks [@tschemmer](https://github.com/tschemmer)! - Emitted schemas share repeated subtrees: identical tails (optional-slot syntagms expand them once per branch) hoist into `$defs` as content-named `shared-*` entries. A consumer module that emitted 12 MB with 22k ref-sites — enough to overflow ajv's call stack at validation — now emits ~30 KB with identical validation behaviour.
- Updated dependencies []:
  - @vertekum/core@0.3.10

## 0.3.9

### Patch Changes

- Updated dependencies [[`a35485a`](https://github.com/moros-oxus/vertekum/commit/a35485a227a9e94271b041bc020f8edf28e0137b)]:
  - @vertekum/core@0.3.9

## 0.3.8

### Patch Changes

- Updated dependencies [[`18e8a1f`](https://github.com/moros-oxus/vertekum/commit/18e8a1fd3343e7dc530188d0b6f094d1dbf92e06)]:
  - @vertekum/core@0.3.8

## 0.3.7

### Patch Changes

- Updated dependencies [[`f72a0a9`](https://github.com/moros-oxus/vertekum/commit/f72a0a9a01b9fa24c535aa3ad8c2259f77676c9c)]:
  - @vertekum/core@0.3.7

## 0.3.6

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a)]:
  - @vertekum/core@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies [[`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec)]:
  - @vertekum/core@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`b591cb5`](https://github.com/moros-oxus/vertekum/commit/b591cb59351c937c0405601eeeee89e33a418fa7), [`83f296c`](https://github.com/moros-oxus/vertekum/commit/83f296c742bd7b5be22f509b4430829b4032605c), [`44122ed`](https://github.com/moros-oxus/vertekum/commit/44122ed8327c4d39b55c8c45d194f423fed96289)]:
  - @vertekum/core@0.3.2

## 0.3.1

### Patch Changes

- [`7f9db48`](https://github.com/moros-oxus/vertekum/commit/7f9db48344c672b90a97f3f4608bf7de893799bf) Thanks [@tschemmer](https://github.com/tschemmer)! - `<@name>` resolution gains key precedence: an import keyed `name` wins outright — its root, else its own `name` production — so sibling imports' public productions can no longer shadow or collide with a keyed module. The cross-import production search remains as the fallback when no key matches.
- Updated dependencies []:
  - @vertekum/core@0.3.1

## 0.3.0

### Minor Changes

- [`1faab42`](https://github.com/moros-oxus/vertekum/commit/1faab429acdd5c53565b3975654ce8da05e89bfc) Thanks [@tschemmer](https://github.com/tschemmer)! - The emission model: public productions emit as open `$defs` patterns (sealing belongs to the positions that apply them, composed via `allOf`); `:name` declares a private production — inlined, invisible to importers; the `scope` pragma names the file's nature (`document` | `def` | `inline` — a def file's root also lands as `$defs.<filename>` and rootless files emit defs-only artifacts by default) while `sealed "true" | "false"` takes over the document-top seal (`scope "branch"` parses as a deprecated alias); the empty leaf dedupes into `$defs.terminal`; `schemaId` derives artifact `$id`s from a configured base; linked emission gains `#/$defs/…` pattern refs; lint reports non-failing warnings (open-merge, deprecations). Atlassian artifacts regenerate under the new shape — the granted vocabulary is unchanged.

### Patch Changes

- [`84172d2`](https://github.com/moros-oxus/vertekum/commit/84172d2ca90320b60ec4c42730a69c056631a81c) Thanks [@tschemmer](https://github.com/tschemmer)! - Affixed scales: a parenthesized formula may carry word fragments on either or both ends — `(2-4)xs` → `2xs 3xs 4xs`, `xs(2-4)`, `x(2-8/2)s` — with the full formula grammar (geometric ratios, quantization, zero-pad) available inside the parentheses. `evaluateScale` gains optional `prefix`/`suffix`; affixes wrap the names while values stay numeric. The additive step is now optional: `2-4` means `2-4/1`.

- [`cd36a42`](https://github.com/moros-oxus/vertekum/commit/cd36a421dbec1a71a06f173a32dbcd4482f85199) Thanks [@tschemmer](https://github.com/tschemmer)! - `schema lint`, `schema fmt`, and `schema build` accept a directory argument and sweep it — `.dfn` sources need not live under `./schemas`. A nonexistent path errors up front instead of `1:1 cannot read`.

- [`be89083`](https://github.com/moros-oxus/vertekum/commit/be89083f58d8d01062240a84679ea9967071b3c4) Thanks [@tschemmer](https://github.com/tschemmer)! - Adds `vertekum schema fmt` — canonical `.dfn` formatting with JS-literal block indentation (indent resolves from `format.indent`, then `.editorconfig`), `--check` as the CI gate — and `schema lint --fix`, which relocates a misplaced trailing `*` into the reference or group it opens. The grammar itself gains block statements: a statement ends at the first newline at bracket depth 0, so a multi-line `[ … ]` may close at any indentation, and an unclosed `[` reports its opening position.

- [`c81e024`](https://github.com/moros-oxus/vertekum/commit/c81e024133cf4f67b3cf690bfb77b849921ca9a2) Thanks [@tschemmer](https://github.com/tschemmer)! - Linked emission (`schemaBuilderExtension({ link: true })`): an unmodified `<@module>` root embedding emits a `$ref` into the child module's own artifact — `"color": { "$ref": "./primitives/color.json#/properties/color" }` — instead of inlining a duplicate. Property keys stay local so sealing is unchanged; modified, open, tailed, and production references still inline, as do modules the project does not build. Default remains self-contained artifacts.

- [`ef1ca4a`](https://github.com/moros-oxus/vertekum/commit/ef1ca4a0b696b799275c0f0acf7fde9414793f8d) Thanks [@tschemmer](https://github.com/tschemmer)! - Pick/omit lists take references as members — set algebra with sets as operands: `<@fullcolors ![<@fullcolors/saturated>, white]>` omits every saturated name plus white. Operands resolve with normal scope and privacy rules, keep member-by-member validation, and an open member reference is refused.

- [`1de5e76`](https://github.com/moros-oxus/vertekum/commit/1de5e76929f9a1e17e6625cb3bfd36a3fd86ceec) Thanks [@tschemmer](https://github.com/tschemmer)! - The input/output pair is configurable on the extension — `schemaBuilderExtension({ source: './src/dfn', out: './src/schemas' })`. `source` becomes the default sweep for `schema build`, `lint`, and `fmt`; `out` redirects built schemas, mirroring `source`'s directory structure. `schema build` also takes a positional `[out]` for one invocation: a directory argument mirrors into it, a file argument lands directly in it.
- Updated dependencies [[`84172d2`](https://github.com/moros-oxus/vertekum/commit/84172d2ca90320b60ec4c42730a69c056631a81c)]:
  - @vertekum/core@0.3.0

## 0.1.7

### Patch Changes

- [`880b288`](https://github.com/moros-oxus/vertekum/commit/880b288630455eaf629f0d458fb38b3eaf0222a6) Thanks [@tschemmer](https://github.com/tschemmer)! - Grammar errors are attributed to the module that contains them — a failure inside an imported module names that file, not the one being linted or built. Referencing a fragment by module name (`<@t-shirt>`) now explains that a fragment has no root and lists its productions to reference instead; a qualified miss lists what the import declares.

## 0.1.6

### Patch Changes

- [`2e9a56f`](https://github.com/moros-oxus/vertekum/commit/2e9a56f5cc52de26ee8768ae0035178ebe4d847e) Thanks [@tschemmer](https://github.com/tschemmer)! - Names may start with digits when they contain a letter (`2xs`, `4k-display`) — everywhere a name works, including pick/omit lists. Pure numbers and scale expressions keep their numeric meaning; the syntax highlighting follows suit.

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
