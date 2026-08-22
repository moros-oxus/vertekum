# Scale expressions

A scale expression enumerates a numeric name set at build time — `100-900/100` instead
of nine names by hand. Two modes, plus word affixes around either:

| Syntax                 | Mode                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| [`min-max/step`](#additive-scales)    | **additive** — arithmetic steps                        |
| [`min-max*factor~quantum`](#geometric-scales) | **geometric** — a ratio, optionally quantized  |
| [`(formula)xs`, `xs(formula)`, `x(formula)s`](#affixed-scales) | **affixed** — word fragments wrapping the names |

Both are inclusive at both ends, and both enumerate **names** — every step must land on
a whole number, because a token name cannot be `31.25`.

## Additive scales

`min-max/step`: from `min`, adding `step`, up to and including `max`. The step is
optional — `2-4` means `2-4/1`.

```dfn
scale = 100-900/100     # 100 200 300 400 500 600 700 800 900
steps = 2-4             # 2 3 4
```

Different regions of one scale are alternation:

```dfn
scale = 0 | 025-100/25 | 150-300/50 | 400-600/100 | 800 | 1000
```

### Zero-padding

Write the numbers as they appear: a leading zero on a written endpoint declares the pad
width for **every** emitted name of that range.

```dfn
scale = 025-100/25      # 025 050 075 100
```

## Geometric scales

`min-max*factor`: from `min`, multiplying by `factor` (fractional ratios allowed), up
to and including `max`. Raw geometric steps rarely land on whole numbers, so the mode
pairs with quantization: `~quantum` rounds each step to the nearest multiple of
`quantum`.

The canonical case — a type scale, ratio 1.25, rounded to the nearest 4:

```dfn
type-scale = 16-64*1.25~4
```

| Raw step  | ×1.25 from | Quantized (~4) |
| --------- | ---------- | -------------- |
| 16        | —          | **16**         |
| 20        | 16         | **20**         |
| 25        | 20         | **24**         |
| 31.25     | 25         | **32**         |
| 39.0625   | 31.25      | **40**         |
| 48.828125 | 39.0625    | **48**         |
| 61.035…   | 48.828125  | **60**         |

(The next raw step, 76.29…, exceeds 64 — the series ends.)

## Affixed scales

A parenthesized formula may carry word fragments on either or both ends, as **one
term** — no whitespace between affix and parenthesis. The full formula grammar applies
inside the parentheses:

| Expression       | Names                          |
| ---------------- | ------------------------------- |
| `(2-4)xs`        | `2xs 3xs 4xs`                   |
| `xs(2-4)`        | `xs2 xs3 xs4`                   |
| `x(2-8/2)s`      | `x2s x4s x6s x8s`               |
| `(02-08/2)xxl`   | `02xxl 04xxl 06xxl 08xxl`       |
| `(16-64*1.25~4)` | `16 20 24 32 40 48 60` — bare parentheses are grouping only |

An affix is a word fragment: letters first, then letters, digits, and hyphens. The
affixes wrap the **name**; the numeric series underneath is unchanged — padding sits
inside the affixes (`02xxl`, never `xxl02` from a suffix form), and every rule below
(inclusive bounds, integrality, collisions) binds on the numbers exactly as if the
affixes were not there. One formula per term — `(2-4)x(1-2)` is refused.

```dfn
t-shirt = (2-4)xs | xsmall | small | medium | large | x(2-8/2)l
```

## The semantics, precisely

These rules are fixed; the same evaluator (in `@vertekum/core`) generates the names
here and, in time, the values a token-side scale materializes — so a name can never
drift from the value it mirrors.

- **Bounds are inclusive and apply to the raw series.** A step enters while
  `raw ≤ max`; the *quantized* value may stand just past a bound (a raw 62.5 with `~25`
  emits 75 even when `max` is 70).
- **Compounding is raw-basis.** The ratio always applies to the exact previous raw
  value, never to a rounded one — rounding influences names, not the progression.
- **Quantization is to the nearest multiple** of the quantum.
- **Every emitted step must be a whole number.** A fractional step with no quantum is a
  build error (`step 22.5 is not a whole number — names are names; quantize (~) or
  adjust the scale`).
- **Collisions are an error.** When two raw steps quantize onto the same name, the
  build refuses, naming the colliding steps — the quantum is too coarse for the factor.
  A silent dedupe would emit fewer names than the expression reads.

## Constraints

| Rule                    | Error otherwise                                    |
| ----------------------- | -------------------------------------------------- |
| `step > 0`, whole (additive) | a stepped scale needs a positive whole-number step |
| `factor > 1` (geometric)| a multiplied scale needs a factor greater than one  |
| `max ≥ min`             | a scale needs max >= min                            |
| `~` only with `*`       | quantization belongs to the geometric mode          |
