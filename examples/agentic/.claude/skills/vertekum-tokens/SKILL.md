---
name: vertekum-tokens
description: Use when creating, editing, or reviewing design tokens in a repo managed by Vertekum
---

# Working with Vertekum tokens

Vertekum manages DTCG design tokens. **The files are the API.** You author token JSON directly
with your normal editing tools; Vertekum resolves, validates, and builds output from them.

## Orient yourself first

```bash
npx vertekum describe --json
```

This is the source of truth for what exists *here*: token sets, compositions, installed
extensions, available exporters and their options, and every command you can run. Read it before
assuming anything — never rely on a remembered list of exporters or commands.

## The loop

1. **Edit** token JSON under the collection directory (`describe` reports its path).
2. **Check** — `npx vertekum check --json`. This is your compiler. It reports dangling aliases,
   invalid compositions, and misconfigured export targets.
3. **Build** — `npx vertekum build`. Writes the configured output targets.
4. **Report** only after check passes with zero errors.

## Rules

- **Never hand-edit build output.** It is generated. Change the tokens and rebuild.
- **Never rename a token by editing text.** Use `npx vertekum token rename <from> <to>` — it
  rewrites every reference. Editing a path by hand leaves dangling aliases that `check` will
  catch but that you will then have to undo.
- **Renaming a whole group** needs `--allow-group`. That flag is a confirmation, not a
  formality: it moves every token beneath the path.
- **`--dry-run`** works on mutating commands. Use it when you are unsure what a change touches.
- **Commit build output** along with the token change. The generated diff is what a human
  reviews, and it is where the consequences of a token change become visible.
- A reference looks like `{color.base}`. It must resolve to a token that exists in the same
  composition.

## When you are stuck

`check` failing with something you do not understand is a signal to stop and ask, not to try
variations. Token structure is a design decision, and a human owns it.
