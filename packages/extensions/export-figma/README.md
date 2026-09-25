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
- **Which collection a token lands in is decided by files, never values.** A token
  belongs to a modifier's collection when a file one of that modifier's contexts
  references defines it — including the *override* pattern, where the default context
  references nothing and another context overrides paths a set defines. Every other
  token belongs to the set whose file defines it. Values change every release; the
  structure a design file binds to does not move with them.
- A path two modifiers override lands under the one **resolved last** (it wins at
  resolution), with a notice; `check` warns about it, since a mode-based tool can show
  only one of them.
- A modifier that overrides nothing emits no collection, and says so.
- A group's own value (`$root`) is named by the group: `color/steel`, beside
  `color/steel/100`.
- **References survive as alias edges** (per mode); a reference whose target has no
  variable is materialized instead — never dropped.
- **Figma is variables and styles**: typography tokens become text styles, shadows
  become effect styles, each with resolved per-property values and bindings to
  member variables where the member was authored as a reference.
- Every variable carries the **Figma-typed value** (`COLOR` as `{r,g,b,a}` floats,
  dimensions as unitless px `FLOAT`, `STRING`, `BOOLEAN`) *and* the verbatim DTCG
  `source` — a consumer of the model loses nothing to any importer's dialect.
- Every variable records its **`sources`**: per mode, the file (set) its value came
  from — where an edit made in a design tool belongs.
- `source.fingerprint` is `sha256:` of the model's collections and styles — never of
  `source` itself — so two models compare equal exactly when a design file would hold
  the same thing.
- `scopes` and `codeSyntax` are reserved fields; nothing populates them yet.

### Versioning

The model's `version` names its **contract** — the shape `model.schema.json`
accepts — not a package release and not the tokens it holds. While the shape is
still settling, the version is a draft (`draft.01` … `draft.03`); once the shape
is declared stable, it takes a calendar version (`YYYY.MM`). The schema is closed,
so any change to the shape — an added optional field included — takes a new
version, and many package releases can share one. Readers should refuse a version
they don't know rather than guess at its shape.

### Several compositions in one model

A target may name several compositions, and they are merged into **one** artifact —
for brands that share a single design file:

```ts
{ id: 'figma', exporter: 'figma', compositions: ['acme', 'globex'], out: 'build/figma' }
```

Which compositions belong together is the only thing to configure. How they combine
is derived from the resolvers' **structure** — which files each one references —
never from what the values happen to be today:

- A collection every composition draws from the **same files** is shared, exactly as
  it is — no modes are added (`core`, loaded by both brands).
- A collection drawn from **different files** gains one mode per composition
  (`acme`, `globex`) — even while the values are identical. If it already has modes,
  the modes become the pairs that exist — `acme/light`, `globex/dark` — and a
  composition that lacks a context contributes no mode for it.
- A value that is an alias depends only on its own file (the design tool resolves the
  alias per mode); a reference that has to be flattened also depends on every file its
  chain passes through.
- Ownership is decided once for all compositions, so a path one composition's
  modifier owns lands in that modifier's collection for every composition.
- A collection only one composition has is kept whole.
- A variable a composition doesn't have simply has no value for that composition's
  modes.
- Styles carry no modes in Figma, so a style whose files differ is emitted once per
  composition (`acme/typography/body`); otherwise it stays shared.

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
| `types` | `Record<$type, TypeContributor>` | a per-target override for how a type becomes variables (below). Custom types normally arrive already lowered to standard types; a `$type` with no mapping is skipped with a notice in `figma.model.json`. |

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

A custom type usually needs nothing here: the extension that owns the type registers a
**lowering** — its value in standard DTCG types — and every exporter receives the
lowered tokens (a `spacial` arrives as four `dimension` tokens and becomes four `FLOAT`
variables, references kept as aliases).

When one target needs a different mapping, `options.types` overrides it for that
target. A contributor maps one mode-value of a token to variable atoms:

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
