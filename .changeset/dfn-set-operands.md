---
"@vertekum/schema-builder": patch
---

Pick/omit lists take references as members — set algebra with sets as operands: `<@fullcolors ![<@fullcolors/saturated>, white]>` omits every saturated name plus white. Operands resolve with normal scope and privacy rules, keep member-by-member validation, and an open member reference is refused.
