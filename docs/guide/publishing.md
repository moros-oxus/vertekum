# Publishing Vertekum

Vertekum is open core. The headless base — the kernel, the CLI, the schema packages, and the
headless exporters — publishes openly: the schema packages under MIT, the rest under
Apache-2.0. The app, the server, the UI kit, and every UI-serving extension stay
`private: true` + `UNLICENSED` for now; they open later, closer to finish.

## What ships

Five packages, in this order (schemas and core have no workspace dependencies, the rest
build on them):

1. `@vertekum/schema-dtcg`, `@vertekum/schema-atlassian`, `@vertekum/core`
2. `@vertekum/cli`, `@vertekum/ext-export-terrazzo`

Everything else in `packages/*` is private, deliberately:

- `vertekum` (the app), `@vertekum/server`, `@vertekum-ui/react` and the UI-serving
  extensions (`ext-dashboard`, `ext-essentials`, `ext-export`, `ext-themes`, `ext-tokens`,
  `ext-value-editors`) — the commercial layer, opening when closer to finish.
- `ext-release` and `ext-stats` — headless-capable but serving the app today.
- `ext-export-css` — headless, but its journey is not complete; it joins the public set
  when it is ready.
- `@vertekum-ui/primitives` — not a library; Vertekum's own token collection (a `tokens/`
  dir and a `vertekum.config.ts`), the tool dogfooding itself.
- Every `examples/*` package.

Each public package carries its `license` field (`MIT` for the schema packages,
`Apache-2.0` for the rest), its own `LICENSE` copy, a `README.md`, and
`publishConfig.access: "public"` (npm rejects a scoped publish without it).

## The dependency shape

The public graph is a real DAG with no edge into a private package:

- `@vertekum/cli` depends on `@vertekum/core` only (plus `commander`/`tsx`) and owns the
  `vertekum` bin. Its headless verbs use `@vertekum/core/node` for file I/O. The dev trio —
  `vertekum` (the app), `@vertekum/server`, `vite` — are **optional peers**: with them
  installed, `vertekum dev` and the app-default extension merge work exactly as in this
  repository; without them, every other verb works, the system default degrades to the
  empty config (core builtins still validate), and `dev` exits `2` with one clear line.
- Both exporters (`ext-export-terrazzo`, and the private `ext-export-css`) import and peer
  on `@vertekum/core` directly — publishable extensions do not ride the app's
  `vertekum/core` subpath (ADR-0029 amendment).

## The packages ship raw TypeScript

There is no build step anywhere. Every `exports` map points at `./src/*.ts`, `@vertekum/cli`
ships `tsx` as a real dependency plus a `loader.mjs` (a declared export) and `bin/` — all of
which must stay in its `files` list. **Consumers compile the source with their own toolchain.**

The `files` allowlists ship `src` and `tsconfig.json` and exclude `*.test.ts(x)`. `README.md`,
`LICENSE`, and `package.json` ride along automatically — npm always includes them regardless
of the allowlist, which is why each public package holds its own `LICENSE` copy.

Every public package carries `repository` (with its monorepo `directory`), `homepage`, and
`bugs`, all pointing at [moros-oxus/vertekum](https://github.com/moros-oxus/vertekum).

## Versioning and releasing

Versions are driven by [changesets](https://github.com/changesets/changesets) — each one a
markdown file recording which public packages bump, at what level, and the changelog line:

```md
---
"@vertekum/core": patch
---

Resolver composition no longer re-parses unchanged set files.
```

They are written by hand as part of the change that warrants them (`.changeset/<slug>.md`;
the AGENTS.md Versioning section is the authoring rule), and accumulate on `main` across
merged branches. Only the five public packages participate — `privatePackages` is off, so
private versions never churn. `@vertekum/core` and `@vertekum/cli` are **linked**: whenever
either releases, both version together, so a core is never shipped that the cli was not
versioned against. `pnpm changeset:status` lists public packages changed on a branch that
no changeset covers.

Releasing is automated: on every push to `main`, the changesets GitHub action
(`.github/workflows/release.yml`) maintains a **"Version Packages" PR** that previews all
pending bumps and changelog lines; merging that PR publishes to npm and tags. The job
runs the full gate (`pnpm lint && pnpm test`) before touching the registry, and
authenticates via **npm Trusted Publishing** (OIDC): each public package on npmjs.com
registers this repository's `release.yml` as its trusted publisher, the job holds
`id-token: write`, and no registry token exists anywhere — npm attaches provenance
attestations automatically. Adding a new public package means registering the trusted
publisher on npmjs.com for it (its FIRST publish must be manual — npm only allows
trusted-publisher setup on an existing package). The manual equivalent still works:

```bash
GITHUB_TOKEN=<read-only PAT> pnpm release:version
                       # bumps versions + writes per-package CHANGELOG.md, empties .changeset/
                       # (the token is for the github changelog generator's commit/PR links)
git diff               # the review artifact: every bump and changelog line
git commit -am "chore(release): version packages"
pnpm release:publish   # publishes changed packages (npm), creates git tags
git push --follow-tags
```

`CHANGELOG.md` is in each public package's `files` list, so the history ships with the
package. Hakoba iteration (below) is version-blind by design — republishing at the same
version is its normal loop — so day-to-day development never touches this flow.

## Local development: Hakoba

[Hakoba](../../../hakoba) is a Verdaccio bridge for consuming work-in-progress packages from
another repo on the same machine.

```bash
# In vertekum
hakoba status              # is the registry up, is this repo attached
hakoba publish --yes       # publish every non-private workspace package

# In the consuming repo
hakoba attach --yes        # route packages via .npmrc and pull them into node_modules
pnpm install

# After republishing from vertekum
hakoba sync                # pull the latest bytes; the committed lockfile stays pristine
```

`hakoba publish` overwrites by unpublishing first, so republishing at the same version is the
normal loop — you do not need to bump versions while iterating.

## Verifying a release

Inspection is not verification. The only real check is installing into a consumer and running
the CLI:

```bash
cd <consuming-repo>/<package-with-config>
npx vertekum --help        # a missing `files` entry surfaces here as a resolution error
npx vertekum check
```

A cheaper standing check that catches allowlist regressions early: `pnpm pack` each public
package and confirm the tarball holds `package.json`, `README.md`, `LICENSE`, and its payload
(`src/` + `tsconfig.json`; `loader.mjs` for the CLI; the schema JSON files for the schema
packages).
