# @vertekum/ext-export-figma

Exports a resolved token composition as a **Figma-shaped model** — collections,
modes, variables, aliases, and styles — plus pluggable **dialect writers** that
reshape the model for specific Figma importers.

## The model is the artifact

The exporter's canonical output, `figma.model.json`, is a versioned document
(schema shipped as `model.schema.json`) describing one composition in Figma's own
vocabulary:

- Each resolver **set** becomes a single-mode collection.
- Each **modifier** becomes a collection whose contexts are its modes, with values
  resolved per context. The composition *is* the topology — nothing to configure.
- **References survive as alias edges** (per mode); a reference whose target has no
  variable is materialized instead — never dropped.
- **Figma is variables and styles**: typography tokens become text styles, shadows
  become effect styles, each with resolved per-property values and bindings to
  member variables where the member was authored as a reference.
- Every variable carries the **Figma-typed value** (`COLOR` as `{r,g,b,a}` floats,
  dimensions as unitless px `FLOAT`, `STRING`, `BOOLEAN`) *and* the verbatim DTCG
  `source` — a consumer of the model loses nothing to any importer's dialect.
- `scopes` and `codeSyntax` are reserved fields; nothing populates them yet.

### Versioning

The model's `version` names its **contract** — the shape `model.schema.json`
accepts — not a package release and not the tokens it holds. While the shape is
still settling, the version is a draft (`draft.01`, `draft.02`, …); once the shape
is declared stable, it takes a calendar version (`YYYY.MM`). The schema is closed,
so any change to the shape — an added optional field included — takes a new
version, and many package releases can share one. Readers should refuse a version
they don't know rather than guess at its shape.

### Several compositions in one model

A target may name several compositions, and they are merged into **one** artifact —
for brands that share a single design file:

```ts
{ id: 'figma', exporter: 'figma', compositions: ['rexall', 'lilly'], out: 'build/figma' }
```

Which compositions belong together is the only thing to configure. How they combine
is derived from the resolvers themselves:

- A collection whose variables resolve **identically** in every composition is left
  exactly as it is — no modes are added.
- A collection that **differs** gains one mode per composition (`rexall`, `lilly`).
  If it already has modes, the modes become the pairs that exist —
  `rexall/light`, `lilly/dark` — and a composition that lacks a context contributes
  no mode for it.
- A collection only one composition has is kept whole.
- A variable a composition doesn't have simply has no value for that composition's
  modes.
- Styles carry no modes in Figma, so a style that differs is emitted once per
  composition (`rexall/typography/body`); identical styles stay shared.

Every absence or collision is recorded in `source.notices`; nothing is invented.
Each merged collection carries `modeSources`, mapping every mode to the composition
and context it came from, so a consumer never parses mode names. The model records
no seat or mode limit: it stays faithful, and a consumer that cannot hold a
collection's modes splits it on import.

## Configuration

```ts
import { figmaExportExtension } from '@vertekum/ext-export-figma';
import { microsoftManifest } from '@vertekum/figma-dialect-microsoft';

export default defineConfig({
  extensions: [figmaExportExtension],
  targets: [
    {
      id: 'figma',
      exporter: 'figma',
      composition: 'default',
      out: 'build/figma',
      options: {
        dialects: [microsoftManifest({ modes: 'native' })],
        types: { /* custom-$type contributors, see below */ },
      },
    },
  ],
});
```

| Option | Value space | Meaning |
| --- | --- | --- |
| `dialects` | `FigmaDialect[]` | writers run over the model; their files land under `<out>/<dialect-id>/`. The model itself is always emitted. |
| `types` | `Record<$type, TypeContributor>` | how a custom type becomes variables (below). A `$type` with no mapping is skipped with a notice in `figma.model.json`. |

## Dialects

A dialect is `{ id, write(model): OutputFile[] }` — a pure function from the model
to one importer's file shape. Ship your own as a package; pass an instance in
`options.dialects`.

The first dialect ships as its own contribution package —
`@vertekum/figma-dialect-microsoft` — targeting the `figma-variables-import`
plugin lineage (sidecar manifest, one DTCG string-dialect file per
collection-mode, with `native`/`split-collections`/`split-files` mode strategies
for seats without multi-mode collections). The model never downgrades; a
dialect's output does.

## Custom types

A contributor maps one mode-value of a token to variable atoms:

```ts
const spacial: TypeContributor = (value, token) =>
  (value as Entry[]).map((entry, i) => ({
    suffix: ['top', 'right', 'bottom', 'left'][i], // extends the token's path
    type: 'FLOAT',
    ...(typeof entry === 'string'
      ? { alias: entry.slice(1, -1) }               // dotted token path
      : { value: entry.value }),
  }));
```

`suffix` unfolds a compound into sibling variables; `alias` becomes a real alias
edge when the target exists in the model.
