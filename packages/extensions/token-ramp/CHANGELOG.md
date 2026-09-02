# @vertekum/ext-token-ramp

## 0.3.8

### Patch Changes

- Updated dependencies [[`18e8a1f`](https://github.com/moros-oxus/vertekum/commit/18e8a1fd3343e7dc530188d0b6f094d1dbf92e06)]:
  - @vertekum/core@0.3.8

## 0.3.7

### Patch Changes

- Updated dependencies [[`f72a0a9`](https://github.com/moros-oxus/vertekum/commit/f72a0a9a01b9fa24c535aa3ad8c2259f77676c9c)]:
  - @vertekum/core@0.3.7

## 0.3.6

### Patch Changes

- [`96145e3`](https://github.com/moros-oxus/vertekum/commit/96145e3894d53b4a9cc95e3c64a3e79c4eca365a) Thanks [@tschemmer](https://github.com/tschemmer)! - Multi-brand ramp physics: settings gain `profiles` (named partials — a brand's ladder, a tweaked curve) and `defaultProfile`; a ramp payload selects one with `profile`. Resolution is per field through defaults ← settings ← profile ← payload, ladders merging by step key; an unknown profile is `ramp/unknown-profile`, never a silent fallback.
- Updated dependencies []:
  - @vertekum/core@0.3.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a)]:
  - @vertekum/core@0.3.5

## 0.3.4

### Patch Changes

- [`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec) Thanks [@tschemmer](https://github.com/tschemmer)! - Group codecs — one payload, many tokens: a leaf group carrying a registered codec key expands into generated child tokens (views with mutation refusal, exported via interchange; alias-resolving payloads). `ValidationInput` gains the raw collection `files` for validators whose subject is group data. First release of `@vertekum/ext-token-ramp`: colour ramps from a single brand anchor — fixed lightness ladder, chroma arched through the anchor in OKLCH, virtual (generated) and committed (`vertekum ramp build [--check]`) modes.
- Updated dependencies [[`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec)]:
  - @vertekum/core@0.3.4
