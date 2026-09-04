# Extending commands — the chain, end to end

One local extension ([`extensions/spacing-shorthand.ts`](extensions/spacing-shorthand.ts))
declares a `spacing` type — one to four dimension entries, CSS-shorthand style — and
joins the **command extension chain** (`ctx.commands.extend`) so the type is usable
everywhere a built-in type is:

| Facet | Chain point | What the link does |
| --- | --- | --- |
| Shorthand input | `extend('token add')`, `extend('token set')` | `'0px 8px'` → the typed array |
| Type inference | same link | no `--type`? 2–4 entries under a `dimension` group → `spacing`; a single `'8px'` → propose `dimension` and let the built-in parse it |
| Loud refusal | same link | five entries → a verb error naming the accepted forms |
| Export presentation | `extend('build')` | exporters see `$type: "string"`, entries joined — terrazzo renders one custom property |

The type itself is a schema patch ([`schemas/spacing.json`](schemas/spacing.json)),
registered by the extension — declaring what a value IS stays a schema concern; the
chain only teaches the verbs and the export how to HANDLE it.

## Try it

```bash
pnpm vertekum check                                  # the spacing token validates

# Inference: no --type, a dimension group above, two entries → stored as spacing.
pnpm vertekum token add space.stack '4px 8px' --dry-run

# Partial proposal: no --type, no group — the link settles `dimension` and the
# built-in parses the value. Stock Vertekum would refuse this for want of a type.
pnpm vertekum token add solo '4px' --dry-run

# Refusal, from the extension's own error:
pnpm vertekum token add space.wild '1px 2px 3px 4px 5px' --dry-run

# Presentation: build/css/tokens.css gets `--space-inset: 0px 8px;`
pnpm vertekum build
```

Handlers **propose, they never write** — the verb applies the outcome once (undo
stays one step), an explicit `--type` always beats an inference, and the check gate
still validates whatever was stored. With no chain registered, every one of these
paths behaves exactly as stock Vertekum.
