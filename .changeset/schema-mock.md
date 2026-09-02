---
"@vertekum/schema-builder": patch
---

`vertekum schema mock` renders the matrix a vocabulary grants: a grouped name listing (`--style names`), a sample DTCG token file with per-type default values (`--style tokens`; types via the `mock.types` glob map, then `--type`), at `least` (every name adjacency once) or `full` (the whole matrix) coverage — and with `--break <p>`, a separate deliberately-broken sibling file that `check` must refuse. Deterministic at a fixed `--seed`; outputs land in the configured `mock.out`.
