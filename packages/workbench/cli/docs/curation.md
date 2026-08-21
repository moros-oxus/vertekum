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

A set is a file: these create and delete `<name>.json` in the collection.

| Verb                | Does                                  | Flags                                            |
| ------------------- | ------------------------------------- | ------------------------------------------------ |
| `set add <name>`    | create a token set (an empty file)    | —                                                |
| `set remove <name>` | delete a set and every token in it    | `--force` (required when it still holds tokens)  |

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
