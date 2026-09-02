# `schema mock` — the matrix, made tangible

A vocabulary grants a space of names. `schema mock` renders that space as files you
can read, validate, and break on purpose:

```bash
# vertekum schema mock [module] [--style names|tokens] [--coverage least|full] [--break <p>] [--type <t>] [--seed <n>]
vertekum schema mock                          # every module in the configured source
vertekum schema mock schemas/color.dfn       # one module
vertekum schema mock --style tokens --break 0.3
```

| Flag | Values | Default | What it does |
| --- | --- | --- | --- |
| `--style` | `names` \| `tokens` | both | `names` writes the markdown listing; `tokens` writes a sample DTCG file. |
| `--coverage` | `least` \| `full` | `least` | How much of the matrix each output holds (below). |
| `--break` | probability `0..1` | `0` | Each token independently breaks with this probability — emitted as a SEPARATE `*.broken.tokens.json`; the clean mock stays valid. |
| `--type` | a DTCG `$type` | `color` | Fallback type for mock tokens (the settings `mock.types` map wins). |
| `--seed` | integer | `1` | The breakage RNG seed — identical invocations produce identical files; vary it to vary the breaks. |

Outputs land in the configured `mock.out` (default `./mocks`), one trio per module:
`<module>.names.md` (grouped by top-level segment, with counts),
`<module>.mock.tokens.json`, and — with `--break` — `<module>.broken.tokens.json`.

## Coverage

- **`least`** — every parent→child name adjacency appears at least once: each member
  of each position is exercised somewhere, without the cross-product. The smoke-test
  size.
- **`full`** — every complete token name the vocabulary grants. On a generative
  module this is the whole matrix; expect thousands.

Token names are the tree's **leaves** — an interior name whose optional tail was
skipped is a group, never a token (that is what `$root` exists for).

## Types and values

A mock token's `$type` resolves through: the settings map → `--type` → `color`.

```ts
schemaBuilderExtension({
  mock: {
    out: './mocks',
    types: { 'color.*': 'color', 'space.*': 'dimension' },  // name-glob → $type
  },
})
```

Values come from a fixed per-type table: color → white, dimension → `0px`,
duration → `0ms`, number → `0`, fontWeight → `400`, fontFamily → `["sans-serif"]`,
cubicBezier → `[0,0,1,1]`, strokeStyle → `"solid"`, and minimal spec objects for the
composites (border, shadow, transition, gradient, typography). An unknown type gets
the string `"mock"`.

## Breakage

With `--break 0.5`, each token has a 50% chance of one deliberate violation — a coin
picks **name** (an ungranted `-broken` sibling, caught by the vocabulary seal) or
**value** (a type-mismatched literal, caught by the format binding; types without a
published value schema break by name instead, so every break stays catchable). Each
broken token carries `$description: "deliberately broken (name|value)"`. Copy the
broken file into a collection and watch `vertekum check` refuse it — a self-test of
the whole validation stack.
