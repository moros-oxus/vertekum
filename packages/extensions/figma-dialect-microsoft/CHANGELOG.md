# @vertekum/figma-dialect-microsoft

## 0.3.15

### Patch Changes

- [`b1819c0`](https://github.com/moros-oxus/vertekum/commit/b1819c0f31411bf73a4fe9854b90ee73f8e3e36d) Thanks [@tschemmer](https://github.com/tschemmer)! - New package: the Microsoft Figma dialect writer, extracted as its own contribution (the terrazzo-plugin pattern). `microsoftManifest(options)` reshapes the Figma-shaped model for the figma-variables-import plugin lineage — sidecar manifest, one DTCG string-dialect file per collection-mode, styles flattened to per-property variables — with `native`, `split-collections`, and `split-files` mode strategies for seats without multi-mode collections.
- Updated dependencies [[`b1819c0`](https://github.com/moros-oxus/vertekum/commit/b1819c0f31411bf73a4fe9854b90ee73f8e3e36d)]:
  - @vertekum/ext-export-figma@0.3.15
