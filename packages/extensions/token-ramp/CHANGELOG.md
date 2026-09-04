# @vertekum/ext-token-ramp

## 0.3.14

### Patch Changes

- Updated dependencies [[`0649de6`](https://github.com/moros-oxus/vertekum/commit/0649de64a8eeec61a64a03a982b622cd5addec17)]:
  - @vertekum/core@0.3.14

## 0.3.13

### Patch Changes

- Updated dependencies [[`def7e25`](https://github.com/moros-oxus/vertekum/commit/def7e25d2a77f892b233f4b2c6fce4705d4f2a19)]:
  - @vertekum/core@0.3.13

## 0.3.12

### Patch Changes

- Updated dependencies [[`bcb1f46`](https://github.com/moros-oxus/vertekum/commit/bcb1f46b9491f24560d88d7a1b416bd13dd553a4)]:
  - @vertekum/core@0.3.12

## 0.3.11

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.11

## 0.3.10

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.3.10

## 0.3.9

### Patch Changes

- [`a35485a`](https://github.com/moros-oxus/vertekum/commit/a35485a227a9e94271b041bc020f8edf28e0137b) Thanks [@tschemmer](https://github.com/tschemmer)! - A group codec's carrier may hold a `$root` token — the root parses as the group's own value and the generated children appear beside it (previously such a group silently generated nothing). `ramp build` now emits every computed stop as `data.ramps` under `--json`, making `--dry-run --json` a first-class value source.
- Updated dependencies [[`a35485a`](https://github.com/moros-oxus/vertekum/commit/a35485a227a9e94271b041bc020f8edf28e0137b)]:
  - @vertekum/core@0.3.9

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
