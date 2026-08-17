import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CONFIG_NAMES = [
  'vertekum.config.ts',
  'vertekum.config.js',
  'vertekum.config.mjs',
];

/**
 * Find a vertekum config by walking `cwd` up through its ancestors (the config's location is the
 * working dir — repo root for a single-repo, package root for a monorepo). Returns the absolute
 * path of the nearest config, or undefined if none exists up to the filesystem root.
 */
export function findConfig(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
