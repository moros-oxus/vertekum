# Vertekum DFN

Syntax highlighting for `.dfn` vocabulary definition files — the grammar language that
declares token vocabularies (productions, pragmas, references with pick/omit modifiers,
ranges) and builds them into JSON Schema files.

## Install

From a packaged `.vsix`:

```bash
code --install-extension vertekum-dfn-0.1.0.vsix
```

To produce the `.vsix` from source: `pnpm --filter vertekum-dfn package`.

## Source of truth

The grammar lives in `@vertekum/schema-builder` (`grammar/dfn.tmLanguage.json`); this
extension bundles a synced copy (`pnpm --filter vertekum-dfn sync`), and a test fails
when the copies drift.
