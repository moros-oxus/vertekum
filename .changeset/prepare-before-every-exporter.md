---
"@vertekum/core": minor
---

Every exporter now receives a prepared input: generated tokens (colour ramps) resolve their references in their own file and compositions first, so each brand's ramp follows its own anchor; custom types arrive lowered to standard DTCG types through the new `TYPE_LOWERING_SERVICE`, with `build` chain presentations answering per exporter (`InterchangePresentationContext.exporter`); `check` warns when two modifiers override the same path (`resolver/shared-override`); `describe` lists lowered types; `modifierOwners` and `exportPath` are exported.
