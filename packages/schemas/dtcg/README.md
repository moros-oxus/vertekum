# @vertekum/schema-dtcg

The DTCG schemas as files.

- **`format.json`** — the published [2025.10 format schema](https://www.designtokens.org/schemas/2025.10/format.json),
  **byte-verbatim**, under its canonical `$id`. All 13 token types with per-type `$value`
  validation, `$root`, `$extends`, both reference forms.
- **`template/`** — a worked starting point for constraining *names*: a vocabulary, its
  denotations, and the token terminus (each explained below).
- **`resolver.json`** — the DTCG Resolver Module 2025.10 document shape (sets, modifiers,
  contexts, resolutionOrder).

## The model: two schemas, validated in parallel

The format schema answers *is every node valid DTCG?* A **vocabulary** answers *are these names
permitted, position by position?* They are validated **independently, side by side** — a
vocabulary never references or composes the format schema:

```
tokens/*.json ──▶ format.json         is every node valid DTCG?
              └─▶ your vocabulary     are these names permitted?
```

Because they never meet, a vocabulary is plain, static JSON Schema — nothing newer than what
editors have validated for a decade. And the format schema holds even where a vocabulary is
silent: a number where a node should be, or a mistyped `$vaule`, is refused regardless.

Keep them apart. Composing the format schema into a vocabulary (`allOf` + sealing) defeats the
seal: the format schema's name pattern evaluates every property, leaving
`unevaluatedProperties: false` nothing to refuse — invented names pass silently.

## The template's three files

| file | concept |
| --- | --- |
| `tokens.vocabulary.json` | the names a system permits, position by position — the taxonomy |
| `tokens.denotations.json` | reusable meaning-units the vocabulary references: what a position *may contain*, defined once, applied at many paths |
| `token.terminus.json` | the terminal: a path ends here, as a token |

A vocabulary references denotations; denotations end in the terminus. Grow the dictionary of
denotations as the system's language grows — e.g. a `prominence` family whose entries
(`subtle`/`normal`/`bold` vs `muted`/`normal`/`emphasis`) different branches reference.

## Writing a vocabulary

### The sealed position

Every position that closes its membership is the same three lines:

```json
{
  "properties": { "…the permitted names…": {} },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

Seal **every** position you govern — sealing only the root closes nothing below it.

`"^\\$": true` captures every `$`-prefixed member — `$type`, `$description`, `$root`, `$value`,
and typos like `$vaule` alike — and accepts it **unjudged**, so sealing doesn't refuse DTCG's own
keys. Judging them is the format schema's job (that's where `$vaule` dies). The passthrough is
inherent to the parallel model: a schema's closure only sees what its own file evaluates, and the
format schema is another file.

> DRY variant: since vocabularies are 2020-12, the passthrough can live once in `$defs` and be
> composed via `allOf` — `unevaluatedProperties` sees through it. Optional sugar; the template
> inlines it.

### The terminus vs `true`

- `{ "$ref": "./token.terminus.json" }` — the path **ends here, as a token**. Requiring `$value`
  is what refuses a group at this position. (Systems using DTCG's pointer tokens widen the
  terminus with `anyOf: [{"required": ["$value"]}, {"required": ["$ref"]}]`.)
- `true` — the vocabulary has **no opinion**: any DTCG-valid node may sit here, *including a group
  with arbitrary descendants*. The format schema still guarantees it is a valid node.

### Denotations and unions

**Sealing a schema closes it against composition** — two sealed denotations composed each refuse
the other's names. So a denotation that participates in a union has two forms:

- `emphasis.open` — names only, unsealed. What unions compose.
- `emphasis` — the open form plus the sealed-position idiom. What positions reference directly.

A union position (`text → emphasis | brand → emphasis`, the tier optional and mixable):

```json
"text": {
  "allOf": [{ "$ref": "./tokens.denotations.json#/$defs/emphasis.open" }],
  "properties": { "brand": { "$ref": "./tokens.denotations.json#/$defs/emphasis" } },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

The `.open` twin exists only for denotations used in unions. A busy position extracts to a named
denotation by cut-paste; used once → inline, reused → extract.

### Loops — rules by name-class

A denotation's members may route back to it, giving rules-by-name-class at any depth the
vocabulary's own recursion reaches — including pattern tiers:

```json
"node": {
  "properties": { "color": { "$ref": "#/$defs/aspectChildren" } },
  "patternProperties": { "^brand-[a-z]+$": { "$ref": "#/$defs/node" }, "^\\$": true },
  "unevaluatedProperties": false
}
```

Positional trees and loops mix freely — at every position the author chooses.

### Files that compose

The template keeps denotations and the terminus in their own files, referenced relatively
(`./tokens.denotations.json#/$defs/emphasis`). Keep all the `$id`s **in one URI directory** (the
template uses `https://example.org/…`) and the relative refs resolve two ways with no
configuration: file-relatively in tools that load schema files from disk, and URI-relatively in
any validator that has the referenced schemas registered.

## Dialects

| schema | dialect | why |
| --- | --- | --- |
| `format.json` | draft-07, as published | verbatim fidelity; its tuple `items` don't even compile as 2020-12 |
| vocabularies | 2020-12 | `unevaluatedProperties` is what makes unions DRY |

They never meet in one compile — pick each validator instance from the schema's declared
`$schema`.

## What the format schema's value rules do and don't do

Per-type `$value` validation fires only on a token's own **inline** `$type` — JSON Schema cannot
see a group-inherited type, so group-typed tokens' values pass vacuously. In 2025.10 that matters:
colours are object-notation (`{colorSpace, components}`), so an inline-typed hex string fails
while the same token typed at the group level passes.

## Upgrading

From this package's directory:

```bash
npm run fetch          # refresh format.json from the canonical URL
git diff format.json   # the review artifact: what the spec changed
npm test               # the schema must still accept/refuse what it claims,
                       # and the templates must still extend it as expected
```

`format.json` must never be reformatted — byte-fidelity to the URL is the point.

## The resolver schema

`resolver.json` is hand-kept against the Resolver Module spec; a drift is a bug.
