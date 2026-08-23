---
"@vertekum/schema-builder": minor
"@vertekum/schema-atlassian": minor
---

The emission model: public productions emit as open `$defs` patterns (sealing belongs to the positions that apply them, composed via `allOf`); `:name` declares a private production — inlined, invisible to importers; the `scope` pragma names the file's nature (`document` | `def` | `inline` — a def file's root also lands as `$defs.<filename>` and rootless files emit defs-only artifacts by default) while `sealed "true" | "false"` takes over the document-top seal (`scope "branch"` parses as a deprecated alias); the empty leaf dedupes into `$defs.terminal`; `schemaId` derives artifact `$id`s from a configured base; linked emission gains `#/$defs/…` pattern refs; lint reports non-failing warnings (open-merge, deprecations). Atlassian artifacts regenerate under the new shape — the granted vocabulary is unchanged.
