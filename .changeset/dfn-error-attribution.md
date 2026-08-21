---
"@vertekum/schema-builder": patch
---

Grammar errors are attributed to the module that contains them — a failure inside an imported module names that file, not the one being linted or built. Referencing a fragment by module name (`<@t-shirt>`) now explains that a fragment has no root and lists its productions to reference instead; a qualified miss lists what the import declares.
