# Resolvers and theming

Theme composition — which sets combine, under which contexts, in what order — is described
by **DTCG Resolver Module** documents (2025.10). A resolver is the truth of composition;
values stay in the token sets, and the resolver only references them.

Resolver documents live in the collection as `<name>.resolver.json`. The name — the file
name minus the suffix — is how an export target's
[`composition` field](./export.md#composition) selects one, which is the usual way a
composition is consumed. `vertekum describe` lists the compositions that exist, with
their modifiers and contexts.

## The document

```json
{
  "version": "2025.10",
  "name": "default",
  "sets": {
    "base": { "sources": [{ "$ref": "core.json" }, { "$ref": "brand.json" }] }
  },
  "modifiers": {
    "scheme": {
      "contexts": {
        "light": [{ "$ref": "light.json" }],
        "dark":  [{ "$ref": "dark.json" }]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/base" },
    { "$ref": "#/modifiers/scheme" }
  ]
}
```

- **`sets`** — named groups of sources that always apply. A source is a set-file
  reference (`{ "$ref": "core.json" }`) or inline DTCG tokens.
- **`modifiers`** — the theme axes. Each maps context names to the sources that context
  contributes; `default` names the context used when no selection chooses one.
- **`resolutionOrder`** — the ordered walk: internal references to sets and modifiers.
  Later sources win.

Unknown top-level keys are preserved verbatim on round-trip.

## Resolution

A **selection** maps modifier names to chosen contexts — `{ "scheme": "dark" }`. An
unselected modifier falls back to its `default`, then to its first context.

Resolution happens at two levels:

- **Structure-level** (`dtcg.resolvers.resolveOrder`): collapse `resolutionOrder` under a
  selection to the ordered list of set files to merge.
- **Value-level** (`dtcg.resolvers.resolveValues`): merge the tokens of those sets — the
  winning token per path is the last set's, base position kept. References are preserved;
  dereference explicitly with `dtcg.tokens.flatten` when literals are wanted.

Both are pure functions; the same code path serves every consumer.

Because a `#/` pointer addresses the *flattened* document, each resolved bundle
re-materializes pointer references against itself: what a pointer targets — and whether
it resolves at all — can legitimately differ per selection.

## Validation

`dtcg.resolvers.validateResolver(doc, knownSetRefs)` reports semantic issues against the
sets that actually exist. Errors should block; warnings advise:

| Code             | Severity | Meaning                                                    |
| ---------------- | -------- | ---------------------------------------------------------- |
| `unknown-source` | error    | A source `$ref` names a token set that does not exist.     |
| `dangling-ref`   | error    | `resolutionOrder` references an undefined set or modifier. |
| `bad-default`    | error    | A modifier's `default` is not one of its contexts.         |
| `empty-contexts` | error    | A modifier has no contexts.                                |
| `single-context` | warning  | A modifier has only one context.                           |

Resolvers are curated from the command line — `vtk resolver add -s sem`,
`vtk resolver add -m theme/dark dark`, … — see the CLI's curation documentation for
the verb surface.

The same checks run as part of `vertekum check`, which adds one collection-level
finding of its own: `unreferenced-set` (warning) — a token set that no resolver
mentions anywhere, in any set's sources or any modifier context. Its tokens are
validated but reach no output. Projects without resolvers never warn: the flat model
merges every file.

## Compositions and export

An export target names a resolver by name — `composition: 'default'` selects
`default.resolver.json`. The runner resolves the composition's default selection as the
exporter's `base` and every non-default modifier context as a variant, so the exporter
receives the whole theme at once — see [export](./export.md#composition). A target with
no `composition` is **flat**: all tokens, no resolution.
