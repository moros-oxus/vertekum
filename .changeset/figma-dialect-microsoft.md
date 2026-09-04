---
"@vertekum/figma-dialect-microsoft": patch
---

New package: the Microsoft Figma dialect writer, extracted as its own contribution (the terrazzo-plugin pattern). `microsoftManifest(options)` reshapes the Figma-shaped model for the figma-variables-import plugin lineage — sidecar manifest, one DTCG string-dialect file per collection-mode, styles flattened to per-property variables — with `native`, `split-collections`, and `split-files` mode strategies for seats without multi-mode collections.
