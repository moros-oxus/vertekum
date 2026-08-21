---
"@vertekum/schema-builder": patch
---

Range terms grow into scale expressions: a leading zero on a written endpoint zero-pads every emitted name (`025-100/25` → `025 050 075 100`), `min-max*factor` declares a geometric scale (fractional factors allowed), and `~quantum` rounds each step to the nearest multiple (`16-64*1.25~4` → `16 20 24 32 40 48 60`). Steps that quantize onto an earlier name are a build error.
