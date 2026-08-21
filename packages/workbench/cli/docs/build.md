# `vertekum build`

Run the configured export targets and write their files. Targets are declared in the
config's `targets` field (see `@vertekum/core`'s export documentation); `build` is the
runner.

```bash
vertekum build
vertekum build --target web
vertekum build --dry-run --json
```

| Flag                | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `--target <id...>`  | Run only these target ids (repeatable / space-separated).               |
| `--dry-run`         | Compute every target and report the files; write nothing.               |
| `--no-check`        | Skip the implied validation pass.                                       |
| `--json`            | Machine-readable report on stdout.                                      |
| `--cwd <dir>`       | Project discovery starts here ([contract](./contract.md#project-discovery)). |

## The implied check

`build` runs the full [`check`](./check.md) pass first and **refuses on errors** —
diagnostics go to stderr, nothing is written, exit `1`:

```
build refused: fix the errors above or pass --no-check
```

The default exists for the caller who only knows `build`: it must not be possible to
emit output from a broken collection by not knowing the other verb. Warnings never
block. `--no-check` overrides — an escape hatch for triage, not a workflow.

## Target selection

- **No `--target`**: every target runs except those with `enabled: false`.
- **`--target <id>`**: exactly the named targets run — including disabled ones, since
  naming one is explicit intent. A target's id defaults to its exporter id when the
  config gives none.
- An id that matches no configured target is an invocation error — exit `2`, naming the
  unknown ids.

A project whose config declares no targets prints `no targets configured` and exits `0`.

## Writing

Each target writes its files under its `out` directory (relative to the working
directory); a file path that would escape it is refused. Missing exporter registry — no
exporter extension configured at all — is an invocation error (exit `2`) with a hint to
add one.

## `--json`

```json
{
  "ok": true,
  "dryRun": false,
  "targets": [
    {
      "id": "web",
      "exporter": "css",
      "composition": "default",
      "files": [
        { "path": "build/css/tokens.css", "bytes": 2048 }
      ]
    }
  ]
}
```

`files[].path` is relative to the working directory (the target's `out` already
prefixed); `bytes` is the content size, so a pipeline can notice an empty or exploded
artifact without reading it.
