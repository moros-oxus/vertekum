import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-docs-', 'extensions');

/** The token's node as it sits on disk — notes are `$extensions` data, so the file is the proof. */
async function nodeOnDisk(
  cwd: string,
  file: string,
  path: string[],
): Promise<Record<string, unknown>> {
  let cursor = JSON.parse(await readFile(join(cwd, 'tokens', file), 'utf8'));
  for (const segment of path) cursor = cursor[segment];
  return cursor;
}

test('a note written during token add lands in $extensions and survives a later edit', async () => {
  const cwd = await fixture();

  // The ergonomic case: one command creates the token and documents it.
  await run(
    'node',
    [
      bin,
      'token',
      'add',
      'color.note',
      '#123456',
      '--type',
      'color',
      // Named explicitly: this project's first set is `brands/print`, and a test that leans on
      // set ORDER is really testing directory traversal.
      '--set',
      'core',
      '--comment',
      'Body copy on light surfaces',
      '--llm',
      'Prefer this when summarising',
    ],
    { cwd },
  );

  const node = await nodeOnDisk(cwd, 'core.json', ['color', 'note']);
  expect(node.$extensions).toEqual({
    'org.vertekum.docs': {
      docs: 'Body copy on light surfaces',
      llm: 'Prefer this when summarising',
    },
  });

  // A type change rewrites the whole node — the path that used to discard extension data.
  await run('node', [bin, 'token', 'set', 'color.note', '--description', 'x'], {
    cwd,
  });
  const after = await nodeOnDisk(cwd, 'core.json', ['color', 'note']);
  expect(after.$extensions).toEqual({
    'org.vertekum.docs': {
      docs: 'Body copy on light surfaces',
      llm: 'Prefer this when summarising',
    },
  });

  // `docs show --json` is the read path an agent uses.
  const shown = await run(
    'node',
    [bin, 'docs', 'show', 'color.note', '--json'],
    {
      cwd,
    },
  );
  expect(JSON.parse(shown.stdout).data).toEqual({
    docs: 'Body copy on light surfaces',
    llm: 'Prefer this when summarising',
  });
}, 60_000);

test('docs set annotates a group, and writes it to disk', async () => {
  const cwd = await fixture();

  await run(
    'node',
    [
      bin,
      'docs',
      'set',
      'color',
      '--docs',
      'Everything under here is brand colour',
    ],
    { cwd },
  );

  // A group is a file node, not a token: the verb must go through a document command, or the
  // runner would persist nothing and still report success.
  const group = await nodeOnDisk(cwd, 'core.json', ['color']);
  expect(group.$extensions).toEqual({
    'org.vertekum.docs': { docs: 'Everything under here is brand colour' },
  });
}, 60_000);

test('an unknown category is refused, naming what the project declares', async () => {
  const cwd = await fixture();
  const failed = await run(
    'node',
    [bin, 'docs', 'remove', 'font.case.upper', '--category', 'dcos'],
    { cwd },
  ).catch((error: { code: number; stderr: string }) => error);

  expect(failed.code).toBe(1);
  expect(failed.stderr).toMatch(/unknown category 'dcos'/);
  expect(failed.stderr).toMatch(/docs, llm, mcp/);
}, 60_000);

test('docs remove takes one category or all of them', async () => {
  const cwd = await fixture();
  await run(
    'node',
    [
      bin,
      'docs',
      'set',
      'font.case.upper',
      '--docs',
      'keep me',
      '--llm',
      'remove me',
    ],
    { cwd },
  );

  await run(
    'node',
    [bin, 'docs', 'remove', 'font.case.upper', '--category', 'llm'],
    { cwd },
  );
  const one = await run(
    'node',
    [bin, 'docs', 'show', 'font.case.upper', '--json'],
    {
      cwd,
    },
  );
  expect(JSON.parse(one.stdout).data).toEqual({ docs: 'keep me' });

  await run('node', [bin, 'docs', 'remove', 'font.case.upper'], { cwd });
  const none = await run(
    'node',
    [bin, 'docs', 'show', 'font.case.upper', '--json'],
    { cwd },
  );
  expect(JSON.parse(none.stdout).data).toEqual({});
}, 60_000);
