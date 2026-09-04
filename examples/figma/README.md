# Figma export — the model and a dialect, three ways

One composition, two modifiers (`color-mode`: light/dark, `density`: cozy/compact),
resolved by the `figma` exporter into the **Figma-shaped model**:

- each resolver **set** → a single-mode collection (`base`, holding what never varies);
- each **modifier** → a collection whose contexts are its modes (`color-mode`,
  `density`), values resolved per context;
- references → **alias edges** (`color/text` → `color/accent`);
- typography → a **text style** with member values;
- every variable carries the Figma-typed value AND the verbatim DTCG `source`.

The Microsoft dialect (`@vertekum/figma-dialect-microsoft` — a contribution
package, the way terrazzo plugins are) reshapes the model for the
`figma-variables-import` plugin lineage. Because not every Figma seat has
multi-mode collections, this example runs **one target per mode strategy** and
COMMITS the results under `output/` — real files to import into real seats:

| Target | Strategy | Output |
| --- | --- | --- |
| `figma-native` | modes as modes | `output/native/` |
| `figma-split-collections` | each context a sibling single-mode collection | `output/split-collections/` |
| `figma-split-files` | one manifest per context, imported selectively | `output/split-files/` |

Each directory holds `figma.model.json` (the canonical, versioned artifact — the
contract for plugins and agents) beside the dialect's `microsoft-manifest/` files.
Colors downgrade to hex and styles flatten to per-property variables there — the
model keeps what the dialect must lose.

```bash
pnpm vertekum build     # regenerates output/ — the committed files are the truth
```

The CLI e2e suite rebuilds this example and byte-compares against the committed
output, so drift between source and artifacts fails loudly.
