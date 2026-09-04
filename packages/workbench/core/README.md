# @vertekum/core

The Vertekum kernel: everything headless. Design tokens go in as DTCG files; composed,
validated, exportable output comes out — no browser, no UI, no server required.

## What it does

- **DTCG parsing and serialization** — the 2025.10 format, including `$root` base values,
  group-level `$type`, and both reference forms (`{alias}` and JSON-Pointer `$ref`). Values
  keep the notation they were authored in; codecs convert per type.
- **Resolver composition** — DTCG Resolver Module documents (sets, modifiers, contexts,
  `resolutionOrder`) are the unit of theming. A composition resolves structure-level and
  value-level, per context.
- **Validation** — references (aliases, pointers, type mismatches), resolver semantics,
  export-target shapes, and schema-file bindings (a project's vocabulary, validated in
  parallel with the format schema) all run as builtins.
- **Exporter registry** — output formats register as exporters with declared option schemas;
  configured `targets` run them repeatably. Exporters plug in as extensions.
- **Config engine** — `defineConfig` / `defineExtension`, typed extension manifests and
  settings, a service registry, and a command registry for contributed CLI verbs.

## Get started

Most projects consume the kernel through the `vertekum` CLI (`@vertekum/cli`):

```bash
npm install --save-dev @vertekum/core @vertekum/cli
```

A project is a directory with a config file and a token collection:

```
my-tokens/
├── vertekum.config.ts
└── tokens/
    ├── core.json               # a token set (DTCG)
    └── default.resolver.json   # a theme composition (DTCG Resolver Module)
```

The config states what **is** — the collection, the schemas the project is held to, the
export targets:

```ts
import { defineConfig } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';

export default defineConfig({
  collection: './tokens',
  extensions: [cssExportExtension],
  targets: [{ id: 'web', exporter: 'css', composition: 'default', out: 'build/css' }],
});
```

Then `vertekum check` validates the collection, `vertekum build` runs the targets, and
`vertekum describe --json` reports what **can** be configured — registered exporters and
their option schemas, validators, compositions.

Direct use is ordinary Node:

```ts
import { dtcg, parseCollection } from '@vertekum/core';
import { readCollection } from '@vertekum/core/node';
```

The `dtcg` facade groups the token and resolver operations (`dtcg.tokens`, `dtcg.values`,
`dtcg.resolvers`) behind one discoverable entry point.

## Documentation

- [Configuration](./docs/config.md) — `vertekum.config.ts`, every field, merge semantics.
- [Schema validation](./docs/schemas.md) — vocabulary bindings, layering, ejection,
  diagnostics.
- [Tokens](./docs/tokens.md) — sets, groups, `$root`, value notation, references.
- [Extension-held token data](./docs/extension-data.md) — token codecs: generative
  payloads materialized into ordinary tokens. (Custom types are a schema concern —
  see schema validation.)
- [Resolvers and theming](./docs/resolvers.md) — compositions, modifiers, resolution.
- [Export](./docs/export.md) — the exporter contract, targets, the run model.
- [Commands](./docs/commands.md) — contributing new verbs and EXTENDING existing
  ones: the command extension chain, its contracts, proposals and refusals.
- [The core API](./docs/api.md) — direct headless use: the `dtcg` facade, the kernel,
  scales.

## License

Apache-2.0
