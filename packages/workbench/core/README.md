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

## Usage

Most projects consume the kernel through the `vertekum` CLI rather than directly. Direct use
is ordinary Node:

```ts
import { parseCollection, createKernel, dtcg } from '@vertekum/core';
```

The `dtcg` facade groups the token and resolver operations (`dtcg.values` codecs, resolution,
serialization) behind one discoverable entry point.

## License

Apache-2.0
