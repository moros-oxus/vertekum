---
"@vertekum/core": patch
"@vertekum/cli": patch
---

Contributed CLI commands can now declare file artifacts on their `CommandResult` (`files`); the runner writes them, keeps `--dry-run` and `--json` faithful, and refuses paths outside the working directory.
