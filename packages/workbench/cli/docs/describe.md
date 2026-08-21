# `vertekum describe`

Print the project's live inventory: what CAN be configured and run here, as opposed to
what the config says IS. Availability is decided by code at activation — no file answers
"which exporters exist in this project" — so the inventory exists nowhere on disk except
through this verb.

```bash
vertekum describe
vertekum describe --json
```

| Flag          | What it does                                                            |
| ------------- | ----------------------------------------------------------------------- |
| `--json`      | The full inventory as JSON on stdout (the text form is a summary).      |
| `--with-ui`   | Also load UI surfaces and include the routes extensions would contribute. |
| `--cwd <dir>` | Project discovery starts here ([contract](./contract.md#project-discovery)). |

This is the verb that makes the CLI navigable for an agent or a script: read the
inventory instead of guessing from memory, then act. Configured `targets` are
deliberately **not** echoed back — they are readable from the config file; `describe`
reports only what cannot be.

## The `--json` payload

| Key            | What it holds                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `project`      | `configPath` (or `null`), `projectDir`, `collectionDir`, the set names, and the token count.                     |
| `extensions`   | Each loaded extension: `id`, `name`, `description`, and the services it registered.                              |
| `exporters`    | Each registered exporter: `id`, `name`, and `options` — its option schema's keys with their descriptions (`null` when it declares none). |
| `validators`   | Every validator that will run in [`check`](./check.md): the built-ins first, then registered ones — `id`, `name`. |
| `schemas`      | The schema bindings in force: `id`, `match`, `target`, `domain`, `severity`, and the resolved `file` path — so the permitted vocabulary can be opened and read. |
| `commands`     | Every runnable command — built-in curation verbs and contributed ones alike: `name`, `description`, `args`, `options`. |
| `compositions` | Each resolver document by name, with its modifiers and their contexts (and defaults) — the values a target's `composition` and a theme selection can take. |
| `routes`       | Only with `--with-ui`: the routes extensions would contribute to a UI host.                                      |

Schema **bodies** are deliberately not serialized — `describe` is an inventory, not a
dump — but each binding's resolved path is, because that is what lets a reader open the
file and see the permitted names for themselves.

## The workflow it enables

```bash
vertekum describe --json | jq '.exporters'    # what output formats exist here?
vertekum describe --json | jq '.schemas'      # what vocabulary am I held to?
vertekum describe --json | jq '.commands'     # what can I run?
```

Config files say what IS; `describe` says what CAN be. An agent that reads the inventory
before acting configures a third-party exporter from its published option schema,
addresses compositions and contexts by their real names, and never relies on a
remembered list that went stale.
