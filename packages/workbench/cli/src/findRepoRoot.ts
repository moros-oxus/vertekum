import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT_MARKERS = ['.git', 'pnpm-workspace.yaml'];

/**
 * Infer the repo root by walking `cwd` up to the nearest ancestor carrying a `.git` dir or a
 * `pnpm-workspace.yaml`. Used as the working dir when no `vertekum.config` is found, so the system
 * runs with `defaultConfig` alone at a sensible root. Falls back to `cwd` when no marker exists.
 */
export function findRepoRoot(cwd: string): string {
  let dir = cwd;
  for (;;) {
    for (const marker of ROOT_MARKERS) {
      if (existsSync(join(dir, marker))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return cwd;
    dir = parent;
  }
}
