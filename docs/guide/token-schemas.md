# Token schemas in Vertekum

How Vertekum consumes schema packages — the knowledge that belongs here, not in the packages:
a schema package knows nothing of Vertekum; Vertekum knows the packages.

## Parallel bindings

Vertekum validates token files against every binding that matches them, independently. The DTCG
format schema is the bundled default binding; a project's vocabulary is a configured one. This is
the "two schemas, validated in parallel" model from `@vertekum/schema-dtcg`'s README, realised as
config:

```ts
export default defineConfig({
  collection: './tokens',
  schemas: [
    {
      from: './schemas',
      domain: 'vocabulary',
      use: { 'tokens.vocabulary.json': '*' },
    },
  ],
});
```

Because each binding reports alone, vocabulary violations arrive clean — one
`vocabulary/unevaluatedProperties` diagnostic at the exact JSON Pointer — and the allowed-names
message lists the full membership, merged across the vocabulary's denotation files.

## Starting from the template

```bash
vertekum schema eject @vertekum/schema-dtcg/template/tokens.vocabulary.json  ./schemas/tokens.vocabulary.json
vertekum schema eject @vertekum/schema-dtcg/template/tokens.denotations.json ./schemas/tokens.denotations.json
vertekum schema eject @vertekum/schema-dtcg/template/token.terminus.json     ./schemas/token.terminus.json
```

Bind the vocabulary (the entry file — its relative refs pull the other two in through the loader),
then edit all three as ordinary source. The refusal gate applies immediately: a verb that would
introduce a name outside the vocabulary refuses and writes nothing.

## How the loader resolves the template's refs

The vocabulary references its denotations relatively (`./tokens.denotations.json#/$defs/emphasis`).
Vertekum's loader resolves that **file-relatively**, loads the target transitively, and registers
it by `$id`. The same ref also resolves **URI-relatively** in any plain validator holding the
registered schemas, because the template keeps every `$id` in one URI directory — which is why
ejected copies keep working in editors and other toolchains without Vertekum in the loop.

## Adopting a published vocabulary

Bind an aspect to the files it governs; nothing else is required:

```ts
schemas: [
  {
    from: '@vertekum/schema-atlassian',
    domain: 'vocabulary',
    use: { 'color.json': 'semantic*.json' },
  },
]
```

To extend or trim one, eject it — the copy is ordinary source, and the refusal gate applies to it
immediately:

```bash
vertekum schema eject @vertekum/schema-atlassian/color.json ./schemas/color.json
```

A vocabulary governs names and order only: what a granted name IS — group, token, `$root` base
value — belongs to the token author, validated by the format schema binding in parallel.

## Dialects

Every binding is validated under the dialect its schema declares — `validateFiles` picks the
matching ajv instance per `$schema` (draft-07, 2019-09, 2020-12). The verbatim `format.json`
(draft-07) is the bundled default token binding; vocabularies are typically 2020-12; the mix is
invisible. Two guards keep this honest:

- `schema/dialect-mismatch` — a schema that declares one dialect but uses another's keywords
  (say, `unevaluatedProperties` in a draft-07 file) would silently enforce less than it reads;
  the loader refuses it instead.
- Remote-*looking* refs are fine: an `http(s)` `$ref` satisfied by an `$id` in a loaded schema
  (the published DTCG schema references its own inlined definitions this way) resolves without
  any network. Only a ref nothing loaded can satisfy is refused (`schema/remote-ref`).

## What the default binding enforces

The default is the published 2025.10 schema, verbatim — including per-type `$value` rules
**wherever a token carries `$type` inline**. Practically:

- `{ "$type": "color", "$value": "#c8102e" }` is refused — 2025.10 colours are object-notation —
  and so is `token add … --type color` with a string value, at the gate.
- The same value under a group carrying `$type` passes: validation is positional and cannot see
  inheritance. Group-level `$type` is the idiom; the verbs already prefer it (omit `--type` and
  the token inherits).
- Alias values (`"{color.base}"`) pass either way.

One defect reports once: branch envelopes and ancestor echoes from the schema's internal dispatch
are curated away, so `check` points at the offending node and nothing else.

The storage-notation question is resolved: values are stored in the 2025.10 object notations, and
`vertekum migrate values` converts an existing repo (see `value-notation.md`). The format binding
still only enforces the corner the spec reaches — tokens carrying `$type` inline — so migration is
what gives group-typed values teeth.
