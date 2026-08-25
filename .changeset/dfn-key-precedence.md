---
"@vertekum/schema-builder": patch
---

`<@name>` resolution gains key precedence: an import keyed `name` wins outright — its root, else its own `name` production — so sibling imports' public productions can no longer shadow or collide with a keyed module. The cross-import production search remains as the fallback when no key matches.
