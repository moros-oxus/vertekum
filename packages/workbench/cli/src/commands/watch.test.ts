import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { Project } from '../loadProject';
import { directoriesUnder, watchPaths } from './watch';

/** A project stub: `watchPaths` reads only the paths and the command registry. */
function projectWith(
  commands: Array<{ name: string; generator?: { reads(): string[] } }>,
): Project {
  return {
    configPath: '/p/vertekum.config.ts',
    projectDir: '/p',
    collectionDir: '/p/tokens',
    kernel: { commands: { list: () => commands } },
  } as unknown as Project;
}

test('watches the collection, the config, and what each generator reads', () => {
  const paths = watchPaths(
    projectWith([
      { name: 'token rename' },
      { name: 'schema build', generator: { reads: () => ['/p/src/dfn'] } },
    ]),
  );
  expect(paths).toEqual(['/p/tokens', '/p/vertekum.config.ts', '/p/src/dfn']);
});

test('a command that is not a generator contributes no path', () => {
  const paths = watchPaths(
    projectWith([{ name: 'schema lint' }, { name: 'schema fmt' }]),
  );
  expect(paths).toEqual(['/p/tokens', '/p/vertekum.config.ts']);
});

test('a path two generators both read is watched once', () => {
  const paths = watchPaths(
    projectWith([
      { name: 'a build', generator: { reads: () => ['/p/shared'] } },
      { name: 'b build', generator: { reads: () => ['/p/shared'] } },
    ]),
  );
  expect(paths.filter((p) => p === '/p/shared')).toHaveLength(1);
});

test('every directory is listed, so each can be watched on its own', () => {
  const root = mkdtempSync(join(tmpdir(), 'vtk-dirs-'));
  mkdirSync(join(root, 'color/brand'), { recursive: true });
  mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
  mkdirSync(join(root, '.git/objects'), { recursive: true });
  writeFileSync(join(root, 'color/core.json'), '{}');

  const found = directoriesUnder(root);
  expect(found).toContain(root);
  expect(found).toContain(join(root, 'color'));
  expect(found).toContain(join(root, 'color/brand'));
  // Installed dependencies and git's store are not project sources.
  expect(found.some((d) => d.includes('node_modules'))).toBe(false);
  expect(found.some((d) => d.includes('.git'))).toBe(false);
});

test('an unreadable or missing directory is skipped, not fatal', () => {
  expect(directoriesUnder(join(tmpdir(), 'vtk-does-not-exist-at-all'))).toEqual(
    [join(tmpdir(), 'vtk-does-not-exist-at-all')],
  );
});

test('the walk stops at the depth limit', () => {
  const root = mkdtempSync(join(tmpdir(), 'vtk-deep-'));
  mkdirSync(join(root, 'a/b/c'), { recursive: true });
  expect(directoriesUnder(root, 1)).toEqual([root, join(root, 'a')]);
});

test('a project with no config watches the collection alone', () => {
  const project = projectWith([]);
  (project as { configPath?: string }).configPath = undefined;
  expect(watchPaths(project)).toEqual(['/p/tokens']);
});
