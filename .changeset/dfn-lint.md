---
"@vertekum/schema-builder": patch
---

Adds `vertekum schema lint`: validate `.dfn` modules — fragments and unused productions included — with findings collected and positioned per file. Grammar errors now point at the offending source (file, line, column) instead of `1:1`, and a misplaced `*` explains where the open-set mark belongs.
