# @vertekum/cli

The headless Vertekum runner: the whole pipeline — parse, compose, validate, export — driven
from the command line. No browser and no UI load unless asked for.

## Verbs

| Verb | What it does |
| --- | --- |
| `vertekum init` | scaffold a project: config, seed tokens, agent skills (`--force`, `--no-skill`; `--skill` refreshes the skills alone) |
| `vertekum check` | run every registered validator and report diagnostics |
| `vertekum build` | run the configured export targets and write their files (`--target <id…>`, `--dry-run`, `--no-check`) |
| `vertekum describe` | print the live inventory: extensions, exporters and their option schemas, validators, commands (`--with-ui` adds routes) |
| `vertekum migrate values` | convert stored string values to 2025.10 object notation, by effective type (`--dry-run`) |
| `vertekum schema eject <source> [dest]` | copy a schema file into the working directory so it can be changed |
| `vertekum dev` | launch the Vertekum UI (Vite + bridge server) |

Extensions may contribute further verbs; they appear in `--help` and `describe` only when the
loaded project actually installs them, so help is honest about what is available *here*.

`vertekum dev` needs the Vertekum app (the `vertekum` package, an optional peer); without it
the command exits `2` with a clear message and every other verb works normally.

## Contract

- **Exit codes:** `1` means the tokens are wrong (diagnostics, failed build); `2` means the
  invocation was (no config found, usage error).
- **Output streams:** stdout is data, stderr is logs — `--json` output stays pipeable.
- **`--dry-run`** prints what would be written without writing; **`--json`** emits
  machine-readable output. Both are owned by the runner, uniformly, including for
  contributed commands.
- **Project discovery:** the config's directory is the working directory. The CLI walks up
  from `--cwd` (default: the current directory) to find `vertekum.config.ts`.

`describe --json` reports what CAN be configured — registered exporters and their option
schemas, validators, compositions; config files only say what IS. That split is what lets an
agent (or a script) learn a project's capabilities instead of guessing them.

## License

Apache-2.0
