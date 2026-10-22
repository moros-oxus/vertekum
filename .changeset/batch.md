---
"@vertekum/cli": minor
---

New `vertekum batch <file>` (or `-` for stdin): runs several commands — the curation verbs and contributed commands — against one in-memory project, validates the end state once and writes once. All or nothing: every line is parsed first, a failing command stops the batch, and nothing is written unless the whole batch passes, so `--dry-run` previews an entire sequence. Lines are written as on the command line; a JSON array of argument arrays also works.
