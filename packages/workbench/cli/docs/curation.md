# Curation verbs

Editing a token's value in place is a file edit — use an editor. Anything
**structural** — creating, deleting, moving, renaming — goes through a verb, because a
verb rewrites every reference the change touches and refuses to write a document that
violates the project's own rules. Hand-editing a rename leaves dangling aliases; the
verb cannot.

```bash
vertekum token rename color.grey color.gray
vertekum group add color.text --type color
vertekum set add brand
```

## The runner model

Every mutating verb — these built-ins and every contributed command alike — runs under
one model:

- **The runner persists.** A verb mutates the in-memory document; the runner writes the
  changed collection files afterwards, once. No verb has its own way to touch the disk.
- **`--dry-run` and `--json` always work** ([contract](./contract.md#shared-flags)) —
  they are the runner's, so no verb can forget them.
- **A verb may not make things worse.** After the mutation, the runner re-checks and
  compares against the diagnostics that existed *before*: a change that would introduce
  a **new** error is refused wholesale (exit `1`, listing what it would have broken).
  Pre-existing problems do not block — a repo that already has errors stays workable;
  the rule is only that a verb cannot add one.
- **Refusal over silence.** A verb that would have done nothing says why and exits `1` —
  `no token at 'color.brand'` — never a quiet no-op an agent cannot see.

## Values on the command line

Wherever a verb takes a value, short forms are accepted and the spec object is stored
(the same codecs as everywhere else — see `@vertekum/core`'s token documentation):

| Effective type | Accepted input                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| `color`        | hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), a CSS colour function (`rgb()`, `hsl()`, `oklch()`…), a named colour, or a JSON value object |
| `dimension`    | a number with a spec unit (`4px`, `0.25rem`), or a JSON value object                   |
| `duration`     | a number with a spec unit (`200ms`, `0.2s`), or a JSON value object                    |
| anything else  | JSON when parseable, else the string as written                                        |

References (`{color.base}`) pass through untouched — aliases are strings by spec.
Unparseable input for a transforming type is a verb error naming the accepted forms,
never a silent string write.

## `token` verbs

| Verb                            | Does                                                | Flags                                   |
| ------------------------------- | --------------------------------------------------- | --------------------------------------- |
| `token add <path> <value>`      | create a token at a dotted path                     | `--type <type>` (required unless a group above declares one), `--description <text>`, `--set <set>` (default `tokens`) |
| `token set <path> [value]`      | change a token's value, type, or description        | `--type <type>`, `--description <text>` (omit `value` when only these change) |
| `token remove <path>`           | delete a token                                      | —                                       |
| `token move <path> <set>`       | move a token to another set (set = file)            | —                                       |
| `token rename <from> <to>`      | rename a token **or group**, rewriting every reference to it | `--allow-group`                  |

`token rename` plans first: it refuses on a collision at the destination, and renaming a
whole group requires `--allow-group` — the flag is a confirmation that every token
beneath the path moves, not a formality. The summary reports both counts:

```
renamed color.grey → color.gray: 12 token(s), 7 reference(s)
```

## `group` verbs

| Verb                  | Does                                        | Flags                                                        |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `group add <path>`    | create a group, optionally declaring its type | `--type <type>` (inherited by every token beneath), `--description <text>`, `--set <set>` |
| `group set <path>`    | declare a group's type or description       | `--type <type>`, `--description <text>`, `--set <set>`       |
| `group remove <path>` | remove a group and everything beneath it    | `--force` (required when it still holds tokens), `--set <set>` |

The group verbs' `--set` defaults to the **first** set (unlike `token add`, whose
default is the `tokens` set).

## `set` verbs

A set is a file: these create and delete `<name>.json` in the collection. A name may
be a path (`brands/brand-a` → `brands/brand-a.json`) — directories are purely
organizational, created and cleaned up as needed.

| Verb                | Does                                  | Flags                                            |
| ------------------- | ------------------------------------- | ------------------------------------------------ |
| `set add <name>`    | create a token set (an empty file)    | —                                                |
| `set remove <name>` | delete a set and every token in it    | `--force` (required when it still holds tokens)  |

## `resolver` verbs

Curate compositions — which sets combine, under which modifier contexts, in what
order (see `@vertekum/core`'s resolver documentation for the model). Seven generic
verbs over an **address path**: the flag names which branch of the resolver document
the `/`-joined path walks.

```
vtk resolver <verb> [-s <path> | -m <path> | <resolver>] [operands…]

  (no flag)  <resolver>                           the resolver itself
  -s         [<resolver>/]<set>                   a set entry
  -m         [<resolver>/]<modifier>[/<context>]  a modifier, or a context under it
```

The leading `<resolver>/` may be elided when the project has exactly one resolver
(with several, eliding refuses and lists the names). A first segment naming an
existing resolver is always read as the resolver — write the full path when a
modifier shares a resolver's name. `vtk` is a bin alias of `vertekum`; either works.

The model's symmetry decides which verbs apply where: **named** children (sets,
modifiers, contexts) get `add`/`remove`; the anonymous **ordered source lists**
inside sets and contexts get `push`/`pop`/`order`; every level gets `list`.

| Verb | Does |
| --- | --- |
| `resolver add <name>` | create a resolver |
| `resolver add -s [r/]<set>` | add a set entry sourcing `<set>.json`, appended to the resolution order |
| `resolver add -m [r/]<mod>/<cxt> <source>` | add a context sourcing `<source>.json` — a missing modifier is created around it (first context becomes the default; a modifier is never created bare) |
| `resolver remove …` | the inverse at every address; a context refuses when it is the default (retarget first) or the last (remove the modifier) |
| `resolver push -s\|-m <path> <sources>` | append sources — **comma-delimited** set names |
| `resolver pop -s\|-m <path> [which]` | remove one source by index or set name (default the last; the last remaining source refuses) |
| `resolver order <addr> …` | reorder the resolution order (no flag) or a source list (`-s`/`-m`): placements `name@{2}[,…]`, a move `1 3`, or a swap `1 3 --swap` |
| `resolver default -m [r/]<mod>/<cxt>` | set a modifier's default context |
| `resolver list [addr]` | show resolvers, or the addressed level |

Only `add` ever creates — every other verb refuses a missing path component and
suggests the closest existing name. Set entries and sources are anchored to real
collection files, so a typo there is a hard error; `add`'s summary states exactly
what it created and warns when a new modifier/context name near-misses an existing
sibling. In the resolution order, a name existing as both a set and a modifier is
addressed as `sets/<name>` / `modifiers/<name>`.

```bash
vtk resolver add -s sem                          # the whole "compose sem" ask, elided
vtk resolver add -m theme/light light            # modifier + first context + default
vtk resolver add -m theme/dark dark
vtk resolver default -m theme/dark
vtk resolver order default sem@{1}
```

## `migrate values`

Convert stored **string** values to 2025.10 object notation, by each token's effective
type (`color`, `dimension`, `duration`):

```bash
vertekum migrate values --dry-run   # see the conversions first
vertekum migrate values
```

Parse-or-report-untouched, never best-effort: a value the codec cannot parse is listed
with its path and left exactly as it was (and the run exits `1` so the leftovers are
not missed). References are never touched. Rerunnable and idempotent — object values
are not strings, so a second run converts nothing. Colours are written in the config's
`defaultColorSpace`.
