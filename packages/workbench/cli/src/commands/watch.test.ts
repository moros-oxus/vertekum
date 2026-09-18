import { expect, test } from 'vitest';
import type { Project } from '../loadProject';
import { watchPaths } from './watch';

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

test('a project with no config watches the collection alone', () => {
  const project = projectWith([]);
  (project as { configPath?: string }).configPath = undefined;
  expect(watchPaths(project)).toEqual(['/p/tokens']);
});
