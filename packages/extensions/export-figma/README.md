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
