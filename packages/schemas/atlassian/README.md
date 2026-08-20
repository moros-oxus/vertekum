# @vertekum/schema-atlassian

The [Atlassian Design System](https://atlassian.design/foundations/tokens/design-tokens) token
path vocabulary, as JSON Schema files.

## What a vocabulary governs

**Names and order — nothing else.** These schemas enforce which names may appear, in what order,
and where the order ends. What a granted name *is* — a group, a `$value` token, a `$ref` token, a
group carrying a `$root` base value — is the token author's choice, validated by the DTCG format
schema running in parallel, never by this one. Every position passes `$`-prefixed keys through
unjudged for exactly that reason.

`src/vocabulary.json` records the source's own base-value placements (the `.$root` entries); the
schemas deliberately do not police them.

## What is in the box

Ten files, one variant each:

| file | shipped names | grants |
| --- | --- | --- |
| `color.json` | 430 | the documented grammar (generative) |
| `motion.json` | 62 | paradigms + component shapes (generative) |
| `elevation.json` | 18 | layer × kind × state (generative) |
| `font.json` · `space.json` | 23 each | exactly what ships |
| `radius.json` | 8 | exactly what ships |
| `border.json` | 3 | exactly what ships |
| `opacity.json` | 2 | exactly what ships |
| `utility.json` | 1 | exactly what ships |
| `atlassian.json` | all 570 | the union of the nine |

**Generative aspects grant the system's grammar, not just its current catalogue.** Color follows
the documented anatomy — `color.<property>.<role>.<emphasis>.<state>` — so a combination the
rules permit (say, a background role at an emphasis Atlassian has not yet minted) validates,
while a name outside the grammar still refuses. The grantable-but-unshipped surplus is pinned by
test to an exact per-aspect count, so it only ever changes as a reviewed edit.

**Aspects seal their branch and leave the root open**, so several can validate the same files
together without refusing each other's branches — the cost is that no aspect refuses an unknown
*top-level* branch. `atlassian.json` is the wholesale schema that seals the root, for adopting the
system entire.

Every file is self-contained: any `$ref` is internal (`#/$defs/…`), nothing external to
resolve. The schemas live in `lib/`, their definition sources in `dfn/` — but specifiers stay
flat: `@vertekum/schema-atlassian/color.json` and `@vertekum/schema-atlassian/color.dfn` both
resolve through the package's exports map, no folder in the path.

```
$ my-validator tokens.json --schema color.json
/color/text  'bland' is not permitted
```

## Extending

Take a copy and edit it — the files are plain JSON Schema, and a copy is ordinary source:

- to **grant a name**, add a position where it belongs:

```json
"marketing": {
  "type": "object",
  "properties": {},
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

(That is the one position shape used everywhere: granted names in `properties`, `$`-keys passed
through, everything else refused. Zero granted names means the path ends there.)

- to **remove a name**, delete its position.

An upstream update no longer flows into an edited copy — that is the trade of owning it: re-copy
and re-apply the edit.

## Derivation

The vocabulary is derived, then curated. Three layers:

- `src/vocabulary.json` — the sorted name list transcribed from `@atlaskit/tokens`: the review
  artifact for upstream changes.
- `dfn/*.dfn` — the **source**: each aspect declared as a grammar module
  (built with `@vertekum/schema-builder`, a devDependency). One expression states names and
  order; shared name-sets are named denotations:

  ```dfn
  property = background | text | icon | border
  color-role = brand | danger | discovery | information | neutral | success | warning
  emphasis = subtlest | subtler | subtle | bold | bolder | boldest
  interaction = hovered | pressed

  root = color.[
      <property>.<role>?.<emphasis>?.<interaction>?
    | <code>
    | …
    ]
  ```

  The root reads as the syntagm; `?` collapses an unused slot (`neutral.hovered` skips
  emphasis); forks are their own named productions. Set modifiers derive narrowed sets in
  place: `<emphasis [bold, bolder, boldest]>` picks members, `<direction ![left]>` omits one.

  A definition module is importable too: `use "@vertekum/schema-atlassian/color.dfn"` exposes
  its denotations, and `<@interaction>` pulls just the one you reference.
- `lib/*.json` — the built schemas (`npm run build`). Each carries a `$comment` stamp naming its
  module; the artifacts are regenerated, never hand-edited, and the test suite fails when they
  are stale.

570 of Atlassian's 585 names ship. Omitted, with reasons recorded in `scripts/derive.ts`:

- `color.rovo.*`, `elevation.rovo.*` — Rovo is Atlassian's AI product surface, not a general vocabulary
- `utility.UNSAFE.*` — a declared escape hatch, and a vocabulary should not bless one

Also deliberately absent: `$type` per branch — a judgement the source artifact does not state.

## Upgrading

From this package's directory:

```bash
npm run derive                # re-derive from @atlaskit/tokens (a devDependency)
git diff src/vocabulary.json  # the review artifact: added and removed names
# apply the additions/removals to the dfn/ modules — a reviewed grammar edit
npm run build                 # regenerate lib/ from dfn/
npm test                      # parity: built schemas grant exactly the vocabulary
```

Read the diff before committing: removing a name starts refusing tokens a consuming project may
still define.
