# @vertekum/figma-dialect-microsoft

A **Figma dialect writer** for the `figma` exporter (`@vertekum/ext-export-figma`):
reshapes the Figma-shaped model into the file shape consumed by the
`microsoft/figma-variables-import` plugin lineage — a sidecar `manifest.json` plus
one DTCG string-dialect file per collection-mode.

```ts
import { microsoftManifest } from '@vertekum/figma-dialect-microsoft';

// in a figma target's options:
options: { dialects: [microsoftManifest({ modes: 'native' })] }
```

Deliberately lossy where the importer demands it: colors downgrade to hex strings,
dimensions to plain numbers, and styles **flatten to per-property variables** (that
importer creates variables only). Nothing is dropped — what the downgrade loses,
the canonical model artifact beside it keeps.

## Mode strategy

Not every Figma seat has multi-mode collections; the `modes` option adjusts the
output while the model keeps full fidelity:

| `modes` | Output |
| --- | --- |
| `'native'` (default) | modes as modes, one file per collection-mode |
| `'split-collections'` | each context becomes a sibling single-mode collection (`color-mode/light`) |
| `'split-files'` | one manifest per context (base collections included in each), imported selectively |

## Writing your own dialect

A dialect is `{ id, write(model): OutputFile[] }` — a pure function over the model
types exported by `@vertekum/ext-export-figma`, shipped as an npm package and
passed in config. This package is the reference implementation.
