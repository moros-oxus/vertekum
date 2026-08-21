# @vertekum/cli

## 0.1.2

### Patch Changes

- Updated dependencies [[`9c0f093`](https://github.com/moros-oxus/vertekum/commit/9c0f093b5016c6c0ca9cb5b5fd48598718e698d9)]:
  - @vertekum/core@0.1.2
  - vertekum@0.1.0
  - @vertekum/server@0.1.0

## 0.1.1

### Patch Changes

- [`6f843f3`](https://github.com/moros-oxus/vertekum/commit/6f843f38d95059910b94057df55e8e553a7d4bc9) Thanks [@tschemmer](https://github.com/tschemmer)! - `vertekum init` now scaffolds a grouped agent-skill set (`.claude/skills/vertekum/…` — a tokens skill covering the full verb, schema, and value-notation surface, plus a release-workflow skill), and `init --skill` refreshes the skills alone without touching the config; skills you have edited (stamp line removed) are never overwritten.

- [`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86) Thanks [@tschemmer](https://github.com/tschemmer)! - Contributed CLI commands can now declare file artifacts on their `CommandResult` (`files`); the runner writes them, keeps `--dry-run` and `--json` faithful, and refuses paths outside the working directory.
- Updated dependencies [[`34b1157`](https://github.com/moros-oxus/vertekum/commit/34b1157546027442bf98437699ea3b9da45ebe86)]:
  - @vertekum/core@0.1.1
  - vertekum@0.1.0
  - @vertekum/server@0.1.0
