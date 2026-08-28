# `vertekum check`

Run every validation the project is subject to and report diagnostics. This is the
collection's compiler: dangling aliases, invalid compositions, vocabulary violations,
and misconfigured export targets all surface here, with a code and a location.

```bash
vertekum check
vertekum check --json
```

| Flag          | What it does                                    |
| ------------- | ----------------------------------------------- |
| `--json`      | Machine-readable report on stdout.              |
| `--cwd <dir>` | Project discovery starts here ([contract](./contract.md#project-discovery)). |

Exit `0` when there are no **errors** — warnings alone never fail the run. Exit `1` on
any error.

## What runs, in what order

1. **Structural** — the files as they sit on disk, before parsing:
   - every schema binding (the DTCG format schemas, the project's configured
     vocabulary, and any bindings installed extensions registered — see
     `@vertekum/core`'s schema documentation),
   - schema-loading problems (`schema/unreadable`, `schema/no-op`, …),
   - resolver sources naming token sets that do not exist (`resolver/unknown-source`).
2. **Relational** — the parsed model: reference validity (dangling aliases, pointer
   type mismatches), resolver semantics (`bad-default`, `empty-contexts`, …), token
   sets no composition references (`resolver/unreferenced-set`, a warning — the set's
   tokens are validated but reach no output; flat projects, which merge every file,
   never warn), export-target shape (unknown exporters and compositions, options
   validated against each exporter's schema), plus any validator a loaded extension
   registered.

A structural **error** stops the pass before the relational checks: the parsed model was
built from files already known to be malformed, so diagnostics derived from it would be
misdirection. Warnings do not stop it.

Checking the raw files first is deliberate: parsing drops what it does not understand,
so a mistyped `$vaule` would be invisible in everything downstream — only the source
shows it.

## Reading the output

Text form, one diagnostic per line:

```
error  schema/unevaluatedProperties  /color/text 'bland' is not permitted — allowed: accent, brand, subtle  (core.json)

1 error(s), 0 warning(s)
```

`--json`:

```json
{
  "ok": false,
  "errors": 1,
  "warnings": 0,
  "diagnostics": [
    {
      "code": "schema/unevaluatedProperties",
      "severity": "error",
      "message": "/color/text 'bland' is not permitted — allowed: accent, brand, subtle",
      "source": "core",
      "file": "core.json",
      "pointer": "/color/text"
    }
  ]
}
```

- `code` is `<domain>/<kind>` — the domain names who is complaining (`schema` for the
  format, a vocabulary's own domain for its rules, `resolver` for composition sources).
- `pointer` is a JSON Pointer into the named file — it names the offending node, which
  is more actionable than a line number.

## Relation to `build`

`build` runs this same pass first and refuses on errors — see
[build](./build.md#the-implied-check). Fixing `check` to zero errors is what makes
`build` willing.
