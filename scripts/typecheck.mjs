#!/usr/bin/env node
/**
 * `pnpm typecheck`: `tsc --noEmit` over every TypeScript project in the repo — each directory
 * holding a tsconfig.json, found by walking the tree, so a new package is covered the day it
 * lands. Runs them all, reports each failing project, exits 1 if any failed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.turbo']);

function projects(dir, out = []) {
  if (existsSync(join(dir, 'tsconfig.json')) && dir !== root) out.push(dir);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      SKIP.has(entry.name) ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    projects(join(dir, entry.name), out);
  }
  return out;
}

const tsc = join(root, 'node_modules/.bin/tsc');
const failed = [];
for (const dir of projects(root)) {
  const name = relative(root, dir);
  const result = spawnSync(tsc, ['--noEmit', '-p', dir], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed.push(name);
    process.stdout.write(`✗ ${name}\n${result.stdout}${result.stderr}\n`);
  }
}
if (failed.length > 0) {
  process.stdout.write(
    `typecheck failed in ${failed.length} project(s): ${failed.join(', ')}\n`,
  );
  process.exit(1);
}
process.stdout.write('typecheck: every project clean\n');
