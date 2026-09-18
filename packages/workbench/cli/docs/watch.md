# `vertekum watch`

Rebuild on every change. One ordered pass — generators, then check, then the export
targets — so an edited `.dfn`, schema or token file reaches whatever consumes the output
without a manual rebuild.

```bash
vertekum watch                 # the development loop
vertekum watch --target web    # only these targets
vertekum watch --json          # one JSON event per line, for tools and agents
vertekum watch --cwd packages/tokens
```

It writes files and nothing else: no port, no protocol, no dev server. A Vite dev server,
Ladle or Storybook watching those files reloads on its own.

## The pass

1. **Reload** — config, extension graph, and the token collection, read fresh from disk.
2. **Generators** — every contributed command that declares itself one, in registration
   order. `vertekum schema build` is the first: a `.dfn` edit rebuilds the JSON Schema
   files before anything is validated against them.
3. **Check** — every registered validator, exactly as `build` implies it.
4. **Targets** — the configured export targets, written.

## What it watches

The token collection directory, the config file, and whatever each generator declares it
reads. `vertekum describe --json` lists the generators and their paths, so the content of
the loop is inspectable rather than implied.

Changes are collected for a short quiet period before a pass starts, so saving several
files at once is one rebuild. Paths the pass itself wrote are ignored — without that, a
generator writing into a watched directory would make the loop feed itself forever.

## When a pass fails

Diagnostics are reported and **the export targets are left alone**, so the files a consumer
is reading stay at the last version that passed: a dev server keeps rendering the last good
output instead of a broken or half-written one. The next good save repairs it. `watch` keeps
running; it exits `0` on Ctrl-C, or `2` if there was no usable project to begin with.

Generated artifacts are the exception, deliberately: built schemas are written before the
check because the check reads them. A failed pass can therefore leave regenerated schemas on
disk — they describe the source as it now is.

## Output

Progress goes to **stderr**, leaving stdout clean. With `--json`, stdout carries one JSON
object per line:

```jsonc
{"event":"watching","paths":["…/tokens","…/src/dfn","…/vertekum.config.ts"]}
{"event":"pass","ok":true,"ms":240,"trigger":"…/tokens/core.json","files":["build/css/tokens.css"]}
{"event":"pass","ok":false,"ms":90,"trigger":"…/tokens/core.json","files":[],"diagnostics":[…]}
```

Line-delimited rather than one array, because the stream never ends — an agent can follow it
without scraping logs.

## Using it from a package script

```jsonc
{ "scripts": { "dev": "vertekum watch" } }
```

Run beside whatever renders the output (`pnpm --parallel run dev`), and a token edit shows up
in the running app.
