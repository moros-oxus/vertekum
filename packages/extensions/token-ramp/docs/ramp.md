# How a shade is calculated

A ramp is built in OKLCH — the perceptual colour space where equal moves look equal —
from exactly one input colour: the **anchor**. Everything else is arithmetic, which is
the point: move the anchor, and the whole family follows.

## 1. The steps come from the scalar

`"scalar": "100-1000/100"` names ten steps: 100, 200, … 1000. Any stepped range
works — `"050-500/50"` names ten differently. Leading zeros set zero-padding.

## 2. Each step gets a lightness

The step number *is* a lightness — a contrast duty — never a measure of saturation.
Two ways to assign it:

- **The curve** (default): lightness travels from `lightness.first` (0.958 — near
  white) to `lightness.last` (0.27 — near black). `ease: 1` spaces the steps evenly;
  raise it to bunch the light end, lower it to bunch the dark end.
- **The ladder**: an explicit `step → L` table in settings (or per-ramp). Where the
  table speaks, it wins — this is how a hand-tuned ladder is reproduced digit for
  digit.

## 3. The anchor lands — and is never repainted

The anchor's own lightness is measured, and it lands on the step whose ladder
lightness is nearest. That step carries the brand colour **verbatim** — its exact
lightness, chroma, hue, and hex. The ladder positions the anchor; it never repaints
it. This is why anchors legitimately land on different steps in different families: a
naturally light brand yellow lands high, a deep brand charcoal lands low.

## 4. Chroma arches through the anchor

Saturation must fall toward both ends — pale washes and deep shades are less
colourful than the brand colour itself. Writing the anchor's chroma as `Cₐ` and its
lightness as `Lₐ`:

- **Lighter than the anchor**: `C = Cₐ × ((1−L) / (1−Lₐ))^kl`, where `kl` is solved
  so the palest step's chroma is exactly `lightFraction × Cₐ` (0.2 by default:
  one-fifth of the brand colour's saturation). Solving per family is what makes the
  palest wash equally washed-out everywhere, *wherever* the anchor landed —
  `kl = ln(lightFraction) / ln((1−L_first) / (1−Lₐ))`.
- **Darker than the anchor**: `C = Cₐ × (L / Lₐ)^darkExponent` (0.85 by default;
  higher means duller deep shades).

## 5. Hue holds — with one escape hatch

Every step keeps the anchor's hue. The exception is `hueDrift`: steps darker than the
anchor rotate linearly, reaching the full drift at the last step. Its reason to exist
is yellow — dark yellows at held hue read as olive; drifting a few degrees toward
orange keeps them amber.

## Worked example

Anchor `#1DB1A8`, measured at OKLCH `L 0.688, C 0.115, h 188.2`, on a ten-step
ladder whose first step is `L 0.958`:

```
kl = ln(0.2) / ln((1 − 0.958)/(1 − 0.688)) = 0.80

step 100 (L 0.958, lighter):  C = 0.115 × ((1−0.958)/(1−0.688))^0.80 = 0.023  → #E1F6F4
step 500 (nearest 0.688):     the anchor, verbatim                             → #1DB1A8
step 600 (L 0.635, darker):   C = 0.115 × (0.635/0.688)^0.85        = 0.107  → #149F97
step 1000 (L 0.270, darker):  C = 0.115 × (0.270/0.688)^0.85        = 0.052  → #002E2B
```

## Profiles — multi-brand physics

A multi-brand system wants each brand's ladder declared once, not repeated in every
ramp. **Profiles** are named partials of the settings:

```ts
tokenRampExtension({
  profiles: {
    brand-a: { ladder: { '100': 0.958, /* … */ '1000': 0.27 } },
    brand-b:  { lightness: { first: 0.97, last: 0.24, ease: 1.15 } },
  },
  defaultProfile: 'brand-a',
})
```

```json
{ "anchor": "{brand.brand-b-rose}", "scalar": "100-1000/100", "profile": "brand-b" }
```

Each ramp's effective physics resolves per field through four layers — built-in
defaults ← top-level settings ← the selected profile ← the payload's own
overrides — with ladder tables merging by step key. The selected profile is the
payload's `profile`, else `defaultProfile`, else none; an unknown name is an error
that lists the defined profiles, never a silent fallback.

## Virtual and committed

A ramp group with no children is **virtual**: the stops exist in the model — for
aliases, validation, and export — but are written nowhere; the payload is the only
storage, and editing a stop directly is refused. `vertekum ramp build` **commits**
them as real tokens (a group with children is never expanded twice), and
`ramp build --check` fails when committed stops no longer match their payload — the
CI guard for a moved anchor.
