# examples/extensions

Three extensions in action: two type extensions to the DTCG schema — one delivered
from config, one from an extension — and a generated colour ramp. DTCG's 2025.10 type set has no `textCase` or `textDecoration`; this
project declares both, and its tokens carry them directly where every tool expects:

```json
"upper": { "$type": "textCase", "$value": "uppercase" }
```

What makes that valid is a **patch document**: a schema whose top level is `$extends`,
mapping anchors of the effective DTCG schema to additive deltas. Patches merge at
load, whichever route delivers them:

```
schemas/text-case.json           the config route — a patch file bound in vertekum.config.ts
schemas/text-decoration.json     the same document shape, delivered by the extension route:
extensions/text-decoration.ts    …imports it and registers it in code
tokens/core.json                 tokens using both types, an alias, a compound — and a ramp
tokens/brands/print.json         a set in a subdirectory — directories are organizational
```

Run `vertekum check` here; it passes. `vertekum build` writes `build/css/tokens.css`.

## Anchors: composing from spec parts

Targets and references use short names derived from the effective DTCG schema —
`dtcg#tokenType`, `dtcg#token`, `dtcg#typographyValue`, `dtcg#tokenValueReference` —
never a spec URL. Because they derive from the schema **in effect**, an ejected or
replaced DTCG binding feeds them too.

A new type is two deltas — widen the type enum, add the value branch:

```json
{
  "$extends": {
    "dtcg#tokenType": { "enum": ["textCase"] },
    "dtcg#token": {
      "allOf": [ { "if": { "properties": { "$type": { "const": "textCase" } } },
                   "then": { "properties": { "$value": {
                     "anyOf": [ { "enum": ["none", "uppercase", "lowercase", "capitalize"] },
                                { "$ref": "dtcg#tokenValueReference" } ] } } } } ]
    }
  }
}
```

The reference arm is authored, not injected: `font.decoration.emphasis` aliases
`{font.decoration.underline}` because the delta says values may be references.

Merge semantics are additive — `enum` and `required` union, `allOf`/`anyOf`/`oneOf`
append, objects deep-merge. Narrowing is what *layered* schemas do; extending only
ever adds.

## The compound extension

`extensions/text-decoration.ts` goes one step further than the config-route patch: it
also extends the **typography compound**, so a typography `$value` may carry a
`textDecoration` member — see `text.link` in the tokens. One extra target in the same
document:

```json
"dtcg#typographyValue": {
  "properties": { "textDecoration": { "enum": ["none", "underline", "overline", "line-through"] } }
}
```

## What the system does with it

- `vertekum check` validates extended-type values through the patched DTCG binding —
  set `font.case.upper` to `"sparkle"` and the refusal is `schema/enum` at
  `/font/case/upper/$value`, exactly as for a spec type.
- The curation verbs treat the tokens as ordinary:
  `vertekum token add font.case.lower lowercase --type textCase`.
- The css exporter emits keyword values directly (`--font-case-upper: uppercase;`)
  and the alias as `var(--font-decoration-underline)`. (Compound `typography`
  emission is the exporter's own concern, independent of type extensions.)
- `vertekum describe --json` lists the bindings in effect with their origins
  (`core` / `config` / `extension`).

## The generated ramp

`color.teal` holds no stops — it is a group carrying a
`org.vertekum.generate/ramp` payload (`@vertekum/ext-token-ramp`): an anchor
referencing `{brand.poolside}` and a scalar naming the steps. The stops are
**generated** into the model — aliasable, validated, exported to css — while the
file stores only the payload. Editing a stop directly is refused;
`vertekum ramp build` writes them as real tokens instead, and
`ramp build --check` guards the committed form. The extension's docs walk the
colour math.

## The dialect, stated plainly

Files using extended types are this project's **declared dialect**: valid against its
effective schema — which travels as these small, bindable documents — but not against
the unextended spec. A tool that validates with the vanilla DTCG schema will refuse
them; a tool handed the project's schema will not. Extension-held data with a
different job — payloads that *generate* tokens — uses `$extensions` and the codec
seam instead; see `@vertekum/core`'s extension-data documentation.
