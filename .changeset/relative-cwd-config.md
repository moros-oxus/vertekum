---
"@vertekum/cli": patch
---

A relative `--cwd` no longer breaks config loading (`ERR_INVALID_MODULE_SPECIFIER`): the working directory is absolutized before discovery and the config is imported by file URL, which also makes loading correct on Windows.
