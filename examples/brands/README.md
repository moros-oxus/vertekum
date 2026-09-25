# Example: brands × color scheme × sub-theme

A reference structure for a multi-brand system, built so that **each axis owns exactly one
decision** and everything else composes through aliases. Nothing is multiplied out: two brands,
two schemes and a handful of sub-themes stay a few small files.

| Axis | Owns | Where |
| --- | --- | --- |
| **brand** (one composition each) | *which colours exist* — anchors, and the ramps generated from them | `tokens/{brand}/palette.json` |
| **sub-theme** (modifier) | *which ramp is "accent"* — `accent.*` aliases a ramp's steps | `tokens/{brand}/sub-theme/*.json` |
| **color-scheme** (modifier) | *which step a role uses* — `surface.background` → `{color.neutral.100}` / `{color.neutral.900}` | `tokens/scheme/{light,dark}.json` — shared by every brand |
| core (set) | scales nothing varies | `tokens/core.json` |

A role resolves through the chain: `action.background` (scheme) → `accent.700` (sub-theme) →
`color.brand.700` (palette). Pick a brand, a sub-theme and a scheme, and the combination falls out.

```bash
pnpm build   # output/css/{acme,globex}/*.css and output/figma/figma.model.json
```

## What each output shows

- **CSS** (terrazzo) — one stylesheet per brand, aliases kept as `var()` chains.
- **Figma model** — both brands in ONE model, four collections:

  | Collection | Modes |
  | --- | --- |
  | `core` | `default` |
  | `palette` | `acme`, `globex` — the only per-brand files |
  | `sub-theme` | `acme/standard`, `acme/vivid`, `globex/standard` — the pairs that exist |
  | `color-scheme` | `light`, `dark` — shared: both brands reference the same files |

  The structure comes from **which files each resolver references**, never from values: retune a
  brand's anchor or a scheme step and the collections, modes and variables stay where they are —
  only the model's `fingerprint` changes. A design file bound to it never has to rebind.

Every context references its own file (no empty default context), so the structure is legible
from the resolvers alone. `globex` has one sub-theme; `check` notes the single-context modifier,
and the model says it emitted no `globex/vivid` mode rather than inventing one.
