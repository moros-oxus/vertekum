# @vertekum/cli

The headless Vertekum runner: the whole pipeline — parse, compose, validate, export —
driven from the command line. No browser and no UI load unless asked for.

## Get started

```bash
npm install --save-dev @vertekum/core @vertekum/cli
npx vertekum init
```

`init` scaffolds a config, a seed token collection, and the agent skills. From there the
everyday loop is:

```bash
vertekum check     # validate: references, compositions, vocabulary, targets
# …edit tokens…
vertekum build     # run the configured export targets
```

`vertekum describe --json` reports what CAN be configured — registered exporters and
their option schemas, validators, compositions, runnable commands; config files only say
what IS. That split is what lets an agent (or a script) learn a project's capabilities
instead of guessing them.

## Verbs

| Verb                                     | What it does                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| [`init`](./docs/init.md)                 | scaffold a project: config, seed tokens, agent skills                    |
| [`check`](./docs/check.md)               | run every registered validator and report diagnostics                    |
| [`build`](./docs/build.md)               | run the configured export targets and write their files                  |
| [`describe`](./docs/describe.md)         | print the live inventory: extensions, exporters, validators, schemas, commands, compositions |
| [`token` / `group` / `set` …](./docs/curation.md) | the curation verbs: structural edits that rewrite references and refuse to break the collection |
| [`migrate values`](./docs/curation.md#migrate-values) | convert stored string values to 2025.10 object notation     |
| [`schema eject`](./docs/schemas.md)      | copy a schema into the working directory so it can be changed            |
| `dev`                                    | launch the Vertekum UI — optional peer; see [the contract](./docs/contract.md#vertekum-dev) |

Extensions may [contribute further verbs](./docs/contributed-commands.md); they appear
in `--help` and `describe` only when the loaded project actually installs them.

## Contract

The short version — [the contract page](./docs/contract.md) is the full one:

- **Exit codes:** `1` means the tokens are wrong (diagnostics, refused build); `2` means
  the invocation was (no config found, usage error).
- **Output streams:** stdout is data, stderr is logs — `--json` output stays pipeable.
- **`--dry-run` / `--json` / `--cwd`** are owned by the runner, uniformly, including for
  contributed commands.
- **Project discovery:** the config's directory is the working directory; the CLI walks
  up from `--cwd` (default: the current directory) to find `vertekum.config.ts`.

## License

Apache-2.0
