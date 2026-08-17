# Changesets

Each file here is one pending release note: which public packages bump, at what level, and
the changelog line consumers will read. A change that alters a public package's shipped
behavior adds one **in the same commit** — written by hand, no wizard needed:

```md
---
"@vertekum/core": patch
---

One changelog-ready sentence: what changed, from a consumer's point of view.
```

Filename: any unique kebab-case slug (`fix-alias-cycles.md`). While packages are 0.x:
breaking → `minor`, everything else → `patch`. `pnpm changeset:status` lists public packages
changed on the branch that no changeset covers; `pnpm changeset --empty` records a
deliberate no-release change. Releasing consumes this directory — see
`docs/guide/publishing.md`.
