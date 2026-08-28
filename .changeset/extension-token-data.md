---
"@vertekum/core": patch
"@vertekum/cli": patch
---

Extending the DTCG schema: patch documents (top-level `$extends` mapping `dtcg#` anchors to additive deltas) declare custom and compound types — tokens carry them directly in `$type`/`$value`, validated by the patched effective schema. Anchors derive from the binding in effect; bindings assemble across config and extension routes with last-wins `id` replacement and origins in `describe`. Extensions can also register token codecs (`'token-codec'` service) that materialize `$extensions`-carried generative payloads into ordinary tokens, and schema bindings (`'schema-bindings'` service) without a config entry.
