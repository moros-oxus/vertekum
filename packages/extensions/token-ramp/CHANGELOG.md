# @vertekum/ext-token-ramp

## 0.3.5

### Patch Changes

- Updated dependencies [[`86eb7a3`](https://github.com/moros-oxus/vertekum/commit/86eb7a33302c84b0db6be1f5e9bb9b1cf77a4d8a)]:
  - @vertekum/core@0.3.5

## 0.3.4

### Patch Changes

- [`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec) Thanks [@tschemmer](https://github.com/tschemmer)! - Group codecs — one payload, many tokens: a leaf group carrying a registered codec key expands into generated child tokens (views with mutation refusal, exported via interchange; alias-resolving payloads). `ValidationInput` gains the raw collection `files` for validators whose subject is group data. First release of `@vertekum/ext-token-ramp`: colour ramps from a single brand anchor — fixed lightness ladder, chroma arched through the anchor in OKLCH, virtual (generated) and committed (`vertekum ramp build [--check]`) modes.
- Updated dependencies [[`b00e906`](https://github.com/moros-oxus/vertekum/commit/b00e906bd3ad52056c6ac34fed920053f05404ec)]:
  - @vertekum/core@0.3.4
