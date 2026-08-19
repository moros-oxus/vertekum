# @vertekum/schema-vocabulary

Shared vocabulary denotations for token schemas, as `.dfn` modules. A denotation is a named
set of permitted names — the meaning layer of a vocabulary — declared once here and composed
into schema definitions with `use`:

```dfn
use "@vertekum/schema-vocabulary/color-role.dfn"

root = color.background.<@color-role>
```

## Modules

| Module | Denotation | Names |
| --- | --- | --- |
| `color-role.dfn` | `color-role` | `brand`, `danger`, `discovery`, `information`, `neutral`, `success`, `warning` |
