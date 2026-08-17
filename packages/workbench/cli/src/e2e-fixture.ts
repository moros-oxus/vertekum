import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onTestFinished } from 'vitest';

/** Test support for the CLI e2e specs — not part of the package's runtime surface. */
export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

/** The published `vertekum` bin, exercised as a real subprocess by the e2e specs. */
export const bin = join(repoRoot, 'packages/workbench/app/bin/vertekum.mjs');

/** Entries never copied into a fixture: installed deps and generated output. */
const SKIP = new Set(['node_modules', 'build', '.vertekum']);

/**
 * A throwaway copy of `examples/unabridged`, so specs never write into the repo's example.
 *
 * It is created INSIDE `examples/unabridged` rather than the system temp dir: pnpm links workspace
 * packages into each consumer's own `node_modules` (the repo root has no `@vertekum/*`), and those links
 * are relative, so a copy anywhere else cannot resolve the config's `vertekum` and
 * `@vertekum/ext-essentials` imports. Living under the example lets Node's resolution walk up into its
 * `node_modules` with no symlink. Each fixture removes itself when its test finishes; `.e2e-*` is
 * git-ignored so a killed run leaves nothing tracked.
 */
export async function exampleFixture(
  prefix: string,
  example = 'unabridged',
): Promise<string> {
  const exampleDir = join(repoRoot, 'examples', example);
  const dir = await mkdtemp(join(exampleDir, `.e2e-${prefix}`));
  // Copied entry by entry, not with a single `cp` of the whole directory: `fs.cp` refuses to copy
  // a directory into its own subdirectory, filter or no filter. `node_modules` is skipped (it is
  // reached by walking up) along with sibling fixtures.
  for (const entry of await readdir(exampleDir)) {
    // Skip generated and installed artifacts. `build/` is gitignored, so a developer who has run
    // `vertekum build` in the example would otherwise seed every fixture with stale output — and a
    // spec asserting "nothing was written" would find a file that was already there.
    if (SKIP.has(entry) || entry.startsWith('.e2e-')) continue;
    await cp(join(exampleDir, entry), join(dir, entry), { recursive: true });
  }
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
