# `vertekum init`

Scaffold a project where none exists yet: a config, a seed collection, and the agent
skills. `init` never loads a project — it is the verb that creates one.

```bash
vertekum init
vertekum init --skill      # refresh only the agent skills
```

| Flag          | What it does                                                        |
| ------------- | ------------------------------------------------------------------- |
| `--force`     | Overwrite an existing `vertekum.config.ts`.                          |
| `--skill`     | Refresh **only** the agent skills; touches nothing else.             |
| `--no-skill`  | Scaffold without writing the agent skills.                           |
| `--cwd <dir>` | Directory to initialize (default: the current directory).            |

Without `--force`, an existing `vertekum.config.ts` stops the run (exit `1`) — `init`
does not put a real project's config at risk. `--skill --force` together is a usage
error (exit `2`): the refresh has its own overwrite rules, below.

## What is written

| File                            | What it is                                                              |
| ------------------------------- | ----------------------------------------------------------------------- |
| `vertekum.config.ts`            | A minimal config — one `collection`; validation works as-is via built-ins. Comments show where extensions and targets go. |
| `tokens/core.json`              | A seed token set: a couple of colour tokens, one referencing the other — enough for `check` and `build` to do real work, small enough to delete. |
| `tokens/default.resolver.json`  | A resolver naming the seed set, no modifiers — the `default` composition, ready for a target to reference. |
| `.claude/skills/vertekum/…`     | The agent skills (below), unless `--no-skill`.                           |

Next step after scaffolding: `vertekum check`.

## The agent skills

`init` writes a grouped skill set under `.claude/skills/vertekum/`, invoked as
`/vertekum:<name>`:

| Skill               | Teaches                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `/vertekum:tokens`  | Working with the collection: orient via `describe --json`, the edit → `check` → `build` loop, structural changes through verbs, what a vocabulary refusal means, how values are stored. |
| `/vertekum:release` | The token release workflow, when the project configures the release extension: diff-derived severity, the changelog, token severity vs. package bump. |

The skills teach the **contract**; `vertekum describe --json` supplies the **facts**.
Anything enumerable at runtime — exporters, options, the exact command list — is
deliberately absent from the skill text, so it cannot go stale in a repo the package
does not control.

### Ownership: the stamp

Each generated skill carries a stamp comment. `init --skill` (and a full `init`)
**overwrites stamped files and never touches stampless ones** — removing the stamp line
is the documented way to take ownership of a copy and keep local edits safe from
refresh. A skipped file is reported with a notice, not silently left.

`init --skill` is the upgrade path: after updating the CLI, it refreshes the skills
alone — no config check, no seed files, nothing else touched.
