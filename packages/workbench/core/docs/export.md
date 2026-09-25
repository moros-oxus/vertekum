# Export

Output formats are **exporters**: pure, headless transforms registered by extensions.
The `targets` [config field](./config.md#targets) declares which exporters run, over
which theme compositions, writing where — so `vertekum build` is repeatable and
reviewable, and every host drives one code path.

Targets are where export meets [theming](./resolvers.md): a target's `composition` names
a resolver document, and the runner resolves the theme's contexts before the exporter
ever sees a token.

## Example

```ts
targets: [
  {
    // the everyday target: the `css` exporter, over the `default` composition
    id: 'web',
    exporter: 'css',
    composition: 'default',
    out: 'build/css',
  },
  {
    // same exporter again, so `id` is required to tell the two runs apart;
    // no composition — flat: every token, no theme resolution
    id: 'audit',
    exporter: 'css',
    out: 'build/audit',
    // off by default; runs only as `vertekum build --target audit`
    enabled: false,
  },
]
```

## Fields

| Field                           | Values                                | Default          | What it does                                        |
| ------------------------------- | ------------------------------------- | ---------------- | --------------------------------------------------- |
| [`exporter`](#exporter)         | an exporter id from the registry      | — (required)     | Which output format runs.                           |
| [`out`](#out)                   | a relative path                       | — (required)     | Where the emitted files land.                       |
| [`composition`](#composition)   | a resolver document name              | — (flat)         | Which theme composition the exporter receives.      |
| [`id`](#id)                     | any string, unique across targets     | the exporter id  | How `--target` names this run.                      |
| [`options`](#options)           | shape declared by the exporter        | —                | Exporter-specific configuration.                    |
| [`enabled`](#enabled)           | `true` \| `false`                     | `true`           | Whether an unnamed `build` includes this target.    |

### `exporter`

An exporter id from the registry — whatever the loaded extensions registered. The ids are
not fixed by the system: `vertekum describe` lists what this project's configuration
actually provides (`css` from `@vertekum/ext-export-css`, the Terrazzo formats from
`@vertekum/ext-export-terrazzo`, …). An unknown id is an error, never a silent skip.

### `out`

The output directory, relative to the config file. Each emitted file's own relative path
is joined beneath it; the runner refuses paths that escape it.

### `composition`

The name of a resolver document from the collection — `'default'` selects
`default.resolver.json`. The runner resolves the composition's default selection as
`base` and every non-default modifier context as a variant, and hands the whole bundle to
the exporter (see [the exporter contract](#the-exporter-contract)). `vertekum describe`
lists the compositions that exist, with their modifiers and contexts.

**Omitted means flat**: the exporter receives every token, unresolved, with no variants —
right for outputs that are not themed (documentation dumps, audits). An unknown name is
an error.

How compositions themselves work — sets, modifiers, contexts, selections — is
[resolvers](./resolvers.md).

### `id`

Names the target, for `vertekum build --target <id>` and for reports. Defaults to the
exporter id, so it only needs stating when two targets share an exporter — but a stable,
intention-revealing id (`web`, `ios-light`) keeps invocations readable. Must be unique
across targets.

### `options`

Passed through to the exporter as-is. The shape is the **exporter's** to declare: each
exporter publishes an options schema, `vertekum check` validates every target's `options`
against it, and `vertekum describe` prints the schema's keys and descriptions — which is
what lets a third-party exporter be configured correctly without reading its source.

### `enabled`

`false` parks a target: an unnamed `vertekum build` skips it, while naming it
(`--target audit`) still runs it, since naming one is explicit intent.

## The run model

`runTargets(targets, ctx)` resolves each target's composition, **prepares** it, runs its
exporter, and returns the emitted files. It is pure — the caller writes (the CLI to disk,
a browser host through its bridge).

### Prepare: what every exporter can rely on

Between resolving and transforming, every exporter's input is prepared the same way:

- **Generated tokens are expanded in their own scope.** A group codec (a colour ramp)
  resolves its references in the carrier's own file first, then in the files its
  compositions resolve it with, and only then across the collection — so a ramp in one
  brand's file follows that brand's anchor even when another brand defines the same path.
- **Custom types arrive as standard DTCG types.** The extension that owns a custom
  `$type` registers a **lowering** — the value expressed as standard-typed children
  (a four-sided spacing value as four `dimension` tokens, references kept as references).
  Resolved bundles and staged files are both lowered, so an exporter never needs to know
  a project's own types.
- **A presentation, per exporter, takes precedence.** A `build` chain link
  ([commands](./commands.md)) may present a token for one exporter — a CSS shorthand for
  a stylesheet tool — and leave every other exporter to the lowering. Precedence:
  presentation for that exporter → lowering → the value as authored.

```ts
import { TYPE_LOWERING_SERVICE, type TypeLoweringService } from '@vertekum/core';

export function activate(ctx) {
  ctx.services.get<TypeLoweringService>(TYPE_LOWERING_SERVICE)?.register({
    type: 'inset',
    lower(token) {
      const [top, right = top, bottom = top, left = right] = token.value as unknown[];
      return {
        top: { type: 'dimension', value: top },
        right: { type: 'dimension', value: right },
        bottom: { type: 'dimension', value: bottom },
        left: { type: 'dimension', value: left },
      };
    },
  });
}
```

`vertekum describe` lists the types that have a lowering.

## The exporter contract

```ts
interface Exporter {
  id: string;              // what a target's `exporter` field names
  name: string;
  optionsSchema?: ZodType; // the shape of a target's `options` for this exporter
  transform(input: ExporterInput): OutputFile[] | Promise<OutputFile[]>;
}
```

`transform` receives a fully prepared input and returns files; it never touches the
filesystem:

```ts
interface ExporterInput {
  base: Token[];        // the composition's default selection, fully resolved
  variants: Array<{     // one entry per non-default modifier context
    modifier: string;
    context: string;
    tokens: Token[];    // fully resolved under that selection
  }>;
  resolver: ResolverDocument; // the raw composition
  tokens: Token[];            // the raw, unresolved token list (lowered)
  target?: string;            // the target's id — artifact identity
  compositions?: Array<{      // present when the target names several compositions;
    name: string;             // base/variants/resolver then hold the first of them
    base: Token[];
    variants: Array<{ modifier: string; context: string; tokens: Token[] }>;
    resolver: ResolverDocument;
  }>;
  files?: Record<string, DtcgNode>; // the collection's raw file trees, verbatim
  options?: unknown;          // the target's options, already validated
}

interface OutputFile {
  path: string;    // relative; the runner decides the output dir and writes
  content: string;
}
```

Most exporters consume `base` and `variants`. The raw `resolver`, `tokens`, and `files`
ride along for exporters that hand the collection to an external tool with its own
resolution engine rather than consuming pre-resolved bundles.

## Registering an exporter

Exporters arrive as extensions. The kernel seeds the shared registry under the
`exporter` service key before any extension activates — like the codec and
schema-binding registries — so registration is one call, and where the extension
sits in the config's `extensions` list never matters:

```ts
import { EXPORTER_SERVICE, type ExporterService } from '@vertekum/core';

export function activate(ctx) {
  ctx.services.get<ExporterService>(EXPORTER_SERVICE)?.register(myExporter);
}
```
