---
"@vertekum/ext-export-terrazzo": patch
---

CSS custom-property names keep their token's case (`color.neutral.A100` → `--color-neutral-A100`), in declarations and `var()` references alike, whatever the `variableName` passed to `@terrazzo/plugin-css` does.
