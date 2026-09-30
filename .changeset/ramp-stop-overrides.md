---
"@vertekum/ext-token-ramp": minor
---

Ramp stops can be overridden: a hand-written stop replaces only itself while the rest keep generating. `ramp build` marks the stops it writes (`"org.vertekum.generate/ramp": "committed"`) and keeps overrides; `--check` ignores them; `data.ramps` reports effective stops and an `overridden` list; `ramp/unknown-stop` warns about a child that names no step. A ramp committed by an earlier version has unmarked stops, which now read as overrides — delete them and run `ramp build` again.
