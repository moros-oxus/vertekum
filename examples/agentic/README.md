# Agentic example — a headless Vertekum consumer

The base setup for agent-driven token work. No UI, no app, no `vertekum dev`.

Everything here was produced by `vertekum init` and then trimmed to what a headless project actually
needs. If you are starting a real repo, run `vertekum init` and compare.

```
vertekum.config.ts                          which extensions load, what is permitted, what gets built
tokens/core.json                            primitives — raw values, unconstrained
tokens/text.json                            the semantic layer — held to a vocabulary
tokens/text-light.json  text-dark.json      per-theme overrides of that layer
tokens/default.resolver.json                how those sets compose
.claude/skills/vertekum/                    the agent's instructions (tokens + release workflows)
```

## The loop

```bash
pnpm --filter @vertekum-example/agentic check     # the compiler
pnpm --filter @vertekum-example/agentic build     # writes build/css/tokens.css
pnpm --filter @vertekum-example/agentic describe  # what exists here
```

An agent edits token JSON directly, runs `check`, and reports only once it passes. `describe --json`
is how it learns what this project can do — which sets exist, which exporters are installed, which
commands it can run — rather than guessing from a remembered list.

## What this example is actually showing

**Extensions are chosen for their capabilities, not inherited.** There is no
`@vertekum/ext-essentials` here. That bundle is a convenience for the batteries-included app; taking
it would pull in the dashboard and the value editors, which contribute only UI. This project names
exactly one extension — `@vertekum/ext-export-css`, the output format it wants — because everything
else it relies on is not an extension at all: reference, resolver, and target validation are core
builtins that run with nothing installed; the vocabulary is schema *files*, named by the root
`schemas` config; and `targets` are root config too, owned by no extension.

**Composition is the point of a resolver.** `core.json` holds raw primitives, `text.json` the
semantic layer that aliases them, and `text-light.json` / `text-dark.json` each override part of that
layer. The resolver names two sets and one modifier, so `build` emits the base plus a
`[data-theme="dark"]` block from a single declaration. Several sets overriding the same path is the
normal case, not an edge one.

**The system says what you may not do.** The `schemas` config binds `@vertekum/schema-atlassian`'s
colour vocabulary to `text*.json`, so the semantic layer is a closed set of names — and a verb that
would step outside it refuses before anything is written:

```bash
$ vertekum token add color.text.bland.subtle '"#000000"' --type color --set text
refused — this change would introduce 1 error(s):
  error  vocabulary/unevaluatedProperties  /color/text 'bland' is not permitted — allowed: accent, brand, code, danger, …  (text.json)
```

Nothing is *required* to exist, so the layer can grow one token at a time; but a name outside the
vocabulary is a schema change, which is deliberately a slower and reviewable process than adding a
token. `core.json` is **not** bound: a system governs the names people consume, not every raw value
behind them, and `use: { 'color.json': 'text*.json' }` is what draws that line.

A published vocabulary is a starting point, not an obligation. To extend or trim it, eject the file
and bind the copy — it is ordinary source from then on:

```bash
vertekum schema eject @vertekum/schema-atlassian/color.json ./schemas/color.json
```

**The tokens are hand-authorable.** No generated identity, no bookkeeping — a token is addressed by
where it is. An agent (or a person) can write these files in any editor and Vertekum will read them.

## What a real project adds

- **Commit the build output.** It is gitignored here because this is a repo fixture, but a consuming
  repo should commit it: the generated diff is what a human reviews when an agent changes a token,
  and it is where the consequences of a change become visible.
- **Pick an output toolchain.** CSS custom properties are first-party. `@vertekum/ext-export-terrazzo`
  adds terrazzo's plugin ecosystem (JS/TS, Tailwind, native) as another target; Style Dictionary
  would be another. They are choices behind one interface, not foundations.
- **Wire versioning.** `@vertekum/ext-release` tracks token changes against a baseline and drives a
  changelog.
- **Write a real schema.** The Atlassian vocabulary here demonstrates the mechanism. Deriving a
  taxonomy for an actual design system is its own piece of work, with its own discussion and
  approval — which is exactly the point of making it a schema.

## See also

`examples/unabridged` is the full reference consumer: every first-party extension, including the UI
ones, for running the app.
