import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture, repoRoot } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-resolver-');

async function resolverOn(cwd: string): Promise<{
  name?: string;
  sets: Record<string, { sources: Array<{ $ref: string }> }>;
  modifiers: Record<
    string,
    { contexts: Record<string, Array<{ $ref: string }>>; default?: string }
  >;
  resolutionOrder: Array<{ $ref: string }>;
}> {
  return JSON.parse(
    await readFile(join(cwd, 'tokens/default.resolver.json'), 'utf8'),
  );
}

test('resolver verbs drive a composition end-to-end, elided paths included', async () => {
  const cwd = await fixture();

  // Membership — the ask a Tamblyn agent was blocked on. Single resolver, so paths elide it.
  await run('node', [bin, 'set', 'add', 'extra'], { cwd });
  const { stdout } = await run(
    'node',
    [bin, 'resolver', 'add', '-s', 'extra', '--json'],
    { cwd },
  );
  expect(JSON.parse(stdout).ok).toBe(true);
  let resolver = await resolverOn(cwd);
  expect(resolver.sets.extra).toEqual({ sources: [{ $ref: 'extra.json' }] });
  expect(resolver.resolutionOrder.at(-1)).toEqual({ $ref: '#/sets/extra' });
  // Authored fields survive the round-trip.
  expect(resolver.name).toBe('Default');

  // Modifier lifecycle: created around its first context (full path), grown (elided path),
  // default retargeted.
  await run(
    'node',
    [bin, 'resolver', 'add', '-m', 'default/density/compact', 'extra'],
    { cwd },
  );
  await run(
    'node',
    [bin, 'resolver', 'add', '-m', 'density/comfortable', 'extra'],
    { cwd },
  );
  await run('node', [bin, 'resolver', 'default', '-m', 'density/comfortable'], {
    cwd,
  });
  resolver = await resolverOn(cwd);
  expect(Object.keys(resolver.modifiers.density?.contexts ?? {})).toEqual([
    'compact',
    'comfortable',
  ]);
  expect(resolver.modifiers.density?.default).toBe('comfortable');

  // Placement reorder + source surgery.
  await run('node', [bin, 'resolver', 'order', 'default', 'density@{0}'], {
    cwd,
  });
  resolver = await resolverOn(cwd);
  expect(resolver.resolutionOrder[0]).toEqual({ $ref: '#/modifiers/density' });

  await run('node', [bin, 'resolver', 'push', '-s', 'core', 'light,dark'], {
    cwd,
  });
  await run('node', [bin, 'resolver', 'pop', '-s', 'core', 'light'], { cwd });
  resolver = await resolverOn(cwd);
  expect(resolver.sets.core?.sources).toEqual([
    { $ref: 'core.json' },
    { $ref: 'dark.json' },
  ]);

  // list --json publishes the structure; the whole session leaves check clean.
  const list = await run(
    'node',
    [bin, 'resolver', 'list', 'default', '--json'],
    { cwd },
  );
  expect(JSON.parse(list.stdout).data.sets).toEqual(['core', 'extra']);
  await run('node', [bin, 'check'], { cwd });
}, 120_000);

test('refusals exit 1 and --dry-run writes nothing', async () => {
  const cwd = await fixture();

  await expect(
    run('node', [bin, 'resolver', 'add', '-s', 'nope'], { cwd }),
  ).rejects.toMatchObject({ code: 1 });

  const before = await readFile(
    join(cwd, 'tokens/default.resolver.json'),
    'utf8',
  );
  const { stdout } = await run(
    'node',
    [bin, 'resolver', 'add', '-s', 'light', '--dry-run', '--json'],
    { cwd },
  );
  expect(JSON.parse(stdout).files).toContain('default.resolver.json');
  expect(
    await readFile(join(cwd, 'tokens/default.resolver.json'), 'utf8'),
  ).toBe(before);
}, 60_000);

test('the vtk bin alias ships beside vertekum', async () => {
  const pkg = JSON.parse(
    await readFile(
      join(repoRoot, 'packages/workbench/cli/package.json'),
      'utf8',
    ),
  );
  expect(pkg.bin.vtk).toBe('./bin/vertekum.mjs');
  expect(pkg.bin.vertekum).toBe('./bin/vertekum.mjs');
});
