# The core API

Everything here is plain Node — no browser, no server. Most projects drive the kernel
through the `vertekum` CLI (`build`, `check`, `describe`); this page is for consumers that
import the package directly: exporters, extensions, scripts, and agents.

## Two entry points

- **`@vertekum/core`** — the environment-neutral surface: parsing, resolution,
  validation, the kernel, the `dtcg` facade. Safe to bundle anywhere.
- **`@vertekum/core/node`** — the filesystem surface: reading and writing a collection.
  A separate subpath so no `node:fs` import ever enters a browser bundle.

## The `dtcg` facade

One discoverable object grouping the pure DTCG operations by domain:

```ts
import { dtcg } from '@vertekum/core';
```

| Root             | Holds                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `dtcg.tokens`    | `isReference`, `referenceToPath`, `indexByPath`, `resolveValue`, `flatten`, `exportPath`, `isPointerObject`, `parsePointer` |
| `dtcg.values`    | `parse`, `render`, `renderHex`, `convertColor`, `COLOR_SPACES` — the [value codecs](./tokens.md#values)        |
| `dtcg.resolvers` | `resolveOrder`, `validateResolver`, `resolveValues`, `parseResolver`, `serializeResolver`, `emptyResolver`     |

The facade is pure operations only — no filesystem, no UI, no document mutation.

## Reading a collection and resolving a theme

```ts
import { dtcg, parseCollection } from '@vertekum/core';
import { readCollection } from '@vertekum/core/node';

const files = await readCollection('./tokens');

// Partition: `*.resolver.json` are resolver documents, the rest are token sets.
const sets = Object.fromEntries(
  Object.entries(files).filter(([name]) => !name.endsWith('.resolver.json')),
);
const tokens = parseCollection(sets);

const resolver = dtcg.resolvers.parseResolver(files['default.resolver.json']);
const dark = dtcg.resolvers.resolveValues(resolver, { scheme: 'dark' }, tokens);
const literal = dtcg.tokens.flatten(dark); // dereference aliases to literals
```

`parseCollection` yields flat `Token` records — `{ id, path, type, value, set, … }` —
with group `$type` inheritance and reference materialization already applied.

## Validating files

`validateFiles` checks raw file trees against schema bindings, before any parsing:

```ts
import { defaultBindings, validateFiles } from '@vertekum/core';

const diagnostics = await validateFiles(files, defaultBindings());
```

With no second argument it applies the built-in DTCG format bindings. To include a
project's configured vocabulary, load the bindings from config first:

```ts
import { loadSchemas } from '@vertekum/core/node';

const { bindings, referenced, diagnostics: loadIssues } = await loadSchemas(
  config.schemas ?? [],
  { dir: projectDir, builtins: defaultBindings() },
);
const diagnostics = await validateFiles(files, bindings, referenced);
```

See [schemas](./schemas.md) for the binding model and diagnostic codes.

## The kernel

`createKernel()` builds the thin runtime an extension host needs: the document store, the
service and command registries, and the config engine.

```ts
import { createKernel } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';

const kernel = createKernel();
kernel.register(cssExportExtension);
kernel.start(); // activates every registered extension

kernel.document.hydrate(files);         // the whole collection: sets and resolver files
const tokens = kernel.document.getAllTokens();
```

- `kernel.document` — the mutable document: `hydrate`, `apply(command)`, `undo`/`redo`,
  `getFiles` (the raw trees — the write path), `getAllTokens`, `getSets`,
  `getResolvers`, `subscribe`.
- `kernel.services` — the shared service registry. Well-known keys: `EXPORTER_SERVICE`
  (the [exporter registry](./export.md)); `TOKEN_CODEC_SERVICE` (token codecs —
  [extension-held token data](./extension-data.md)); `SCHEMA_BINDING_SERVICE`
  (extension-contributed [schema bindings](./schemas.md#extension-contributed-bindings)).
  The codec and binding registries are pre-created by the kernel — core itself consumes
  them — so `ctx.services.get(...)` always finds them during activation.
- `kernel.commands` — the command registry: the built-in curation verbs plus whatever
  extensions contribute.
- `kernel.config` — extension settings, validated against each extension's declared
  schema.

The document holds the parsed files **untransformed** — the file is the model, so
everything a flat token list cannot represent (group metadata, vendor extensions,
unmodelled keys) survives every edit. Mutations are commands (`addToken`,
`updateTokenValue`, `renamePath`, …), each undoable; `renamePath` rewrites the aliases
that target the renamed path across every set.

Persisting is the caller's job: `saveDocument` (from `@vertekum/core/node`) writes the
document's files back to the collection directory, and `writeCollection` /
`writeTextFile` are the lower-level pieces (the latter refuses to escape the collection
directory).

## Extension-held token data, and schema assembly

The codec seam in API terms — [the reference](./extension-data.md) covers the model
(custom types are a schema concern instead: see
[extending the DTCG schema](./schemas.md#extending-the-dtcg-schema)):

- `TokenCodec` / `TokenCodecService` / `TOKEN_CODEC_SERVICE` — register a VALUE codec
  (`{ key, materialize, serialize }`; carrier ⇄ one token) or a GROUP codec
  (`{ key, expand }`; leaf carrier group → generated child tokens, refused by the
  mutation verbs). `token.codec`/`codecSource`/`generated` carry the provenance.
  Registering after `hydrate` refreshes the derived token view
  (`document.invalidateDerived()`) without counting as a mutation.
- `SchemaBindingService` / `SCHEMA_BINDING_SERVICE` — register a `SchemaBinding`
  programmatically; it layers into `vertekum check` beside configured bindings.
- `interchangeFiles(files, tokens)` — the exporter-side form: carrier nodes inlined as
  plain `$type`/`$value` nodes in a clone. `runTargets` applies it automatically; call
  it directly when handing collection files to an external tool yourself.
- `parseCollection(files, codecs?)` / `tokenNode(token, codecs?)` — the pure functions
  under it all, for drivers that bypass the kernel.
- `assembleBindings(bindings)` — the schema-assembly pass `check` and `describe` run:
  cross-route `id` resolution, `$extends` patch merging into the effective DTCG
  schema, and the `dtcg#` anchor shell as a referenced schema.

## Running exports

`runTargets` is the same pure runner `vertekum build` uses — see
[export](./export.md#running-targets) for its semantics.

## Scales

`evaluateScale` generates a numeric scale's names and values from one expression, so a
name can never drift from the value it mirrors:

```ts
import { evaluateScale } from '@vertekum/core';

evaluateScale({ kind: 'stepped', min: 25, max: 100, step: 25, pad: 3 });
// names: ['025', '050', '075', '100'], values: [25, 50, 75, 100]

evaluateScale({ kind: 'multiplied', min: 16, max: 64, factor: 1.25, quantum: 4 });
// names: ['16', '20', '24', '32', '40', '48', '60'] — each raw step quantized to the nearest 4

evaluateScale({ kind: 'stepped', min: 2, max: 8, step: 2, pad: 2, suffix: 'xxl' });
// names: ['02xxl', '04xxl', '06xxl', '08xxl'], values: [2, 4, 6, 8]
```

Optional `prefix` and `suffix` wrap each **name** (padding sits inside the affixes);
`values` stay numeric, which is what lets a name like `2xs` mirror the value `2`.

Bounds are inclusive and apply to the raw series; geometric compounding is raw-basis (the
factor never applies to a rounded value); a quantized value may stand just past `max`.
Steps whose quantized value lands on an earlier entry are deduped and reported in
`collisions` — the caller decides whether that is an error. A non-integer step with no
quantum throws: names are names.
