# `vertekum batch`

Runs several commands against the collection as one change: validated once and written
once.

```bash
vertekum batch changes.batch            # run the file's commands, write once
vertekum batch changes.batch --dry-run  # run and validate the whole sequence, write nothing
generate-changes | vertekum batch -     # read the batch from stdin
```

Each verb on its own is validated and written by itself, so a sequence whose
*intermediate* states break a rule can't run one command at a time. A shared token that
references a ramp one brand lacks dangles for that brand until the brand overrides it. As a
batch, only the **end state** has to pass.

## The batch file

One command per line, written as you would type it: a leading `vertekum` (or `vtk`) is
optional, quotes work as in a POSIX shell, and blank lines and `#` comments are skipped.

```sh
# a shared token and its brand override, together
token add color.accent '{color.berry.500}' --type color --set core
token add color.accent '{color.brand.500}' --type color --set globex/palette
token rename color.old color.new
```

Or JSON, when the content starts with `[`: an array of argument arrays, for generators that
would rather not quote.

```json
[
  ["token", "add", "color.accent", "{color.berry.500}", "--type", "color", "--set", "core"],
  ["token", "add", "color.accent", "{color.brand.500}", "--type", "color", "--set", "globex/palette"]
]
```

A batch file's path is relative to where you run the command.

## What can run

Every command that changes tokens: the [curation verbs](./curation.md) (`token …`,
`group …`, `set …`, `resolver …`) and every command an extension contributes
(`ramp build`, `schema build`, …). The reporting and host verbs (`build`, `check`,
`describe`, `watch`, `init`, `dev`, `migrate`, `batch`) can't; run them after the batch.
`--dry-run`, `--json` and `--cwd` belong to the batch, so a line carrying one is refused.

## All or nothing

1. **Every line is parsed first.** An unknown command, a usage error or a refused flag exits
   `2`, naming the line, before anything runs.
2. **The commands run in order**, each seeing every earlier change. One that fails (`no
   token at …`) stops the batch: exit `1`, naming the line.
3. **The end state is validated once**, by the rule every verb follows: the batch may not
   introduce an error. Pre-existing problems don't block it.
4. **Then it's written once:** the sets that changed, each in its own key order, and every
   command's file artifacts.

If any step fails, nothing is written.

## Output

Each command's summary, prefixed by its line number, then the files written:

```
2: added color.accent (color) to core
3: added color.accent (color) to globex/palette
wrote core.json
wrote globex/palette.json
```

`--json` prints
`{ "ok": true, "command": "batch", "dryRun": false, "files": [...], "results": [{ "line", "command", "summary", "data" }] }`.
A failing line gives `{ "ok": false, "command": "batch", "line": 3, "error": "…" }`, and a
refused end state gives `{ "ok": false, "command": "batch", "error": "…", "diagnostics": [...] }`.
