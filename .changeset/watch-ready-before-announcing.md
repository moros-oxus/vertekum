---
"@vertekum/cli": patch
---

`vertekum watch` no longer misses a change saved immediately after it starts: it now announces `watching` only once every watcher is armed, rather than just before attaching them. A save landing in that window raised no event at all and was lost outright — rare on a fast machine, ordinary on a slow one.
