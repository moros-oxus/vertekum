# @vertekum/ext-token-docs

## 0.8.0

### Patch Changes

- Updated dependencies [[`1db40a5`](https://github.com/moros-oxus/vertekum/commit/1db40a5da6dece6300cb5b47afccacf5a047c802)]:
  - @vertekum/core@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @vertekum/core@0.7.0

## 0.6.0

### Minor Changes

- [`f5900fe`](https://github.com/moros-oxus/vertekum/commit/f5900fe07b46dfea7cf5e6fd23b2a31e4b8cc512) Thanks [@tschemmer](https://github.com/tschemmer)! - Tokens and groups can carry notes for documentation, agents and MCP: `@vertekum/ext-token-docs` stores one note per configured category under `org.vertekum.docs`, written while a token is created or changed (`token add … --comment "…"`) or through `docs set|show|remove`. Core now preserves every `$extensions` key verbatim — the old allow-list silently dropped unrecognised `org.vertekum.*` keys whenever a node was rewritten — and a command-chain link can read the invocation's options and attach `$extensions` data through `ValueProposal.extensions`.

### Patch Changes

- Updated dependencies [[`f5900fe`](https://github.com/moros-oxus/vertekum/commit/f5900fe07b46dfea7cf5e6fd23b2a31e4b8cc512)]:
  - @vertekum/core@0.6.0
