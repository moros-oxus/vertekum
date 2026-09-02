---
"@vertekum/core": patch
---

`{group}` references resolve to the group's `$root` token, as the spec intends — `$root` never appears in a reference (the format schema forbids `$` segments), exactly as it never appears in an exported name. Previously a `$root` token could not be legally referenced at all.
