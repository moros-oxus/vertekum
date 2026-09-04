---
"@vertekum/core": patch
"@vertekum/cli": patch
"@vertekum/ext-export-terrazzo": patch
---

A reference is now exactly one curly alias — a multi-brace string like `{a} {b}` is a plain value (typically shorthand for the command extension chain), never a single reference, so pure-reference shorthands reach `token add`/`token set` chain links instead of being swallowed. The kernel also seeds the exporter registry before extensions activate, retiring the get-or-create ritual: an exporter extension just get()s `EXPORTER_SERVICE` and registers, and `build` reports "no exporters registered" when the registry is empty.
