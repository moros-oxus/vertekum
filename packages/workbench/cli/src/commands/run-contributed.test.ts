import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renamePath } from '@vertekum/core';
import { expect, test, vi } from 'vitest';
import { exampleFixture } from '../e2e-fixture';
import { loadProject } from '../loadProject';
import { runContributed } from './run-contributed';

const silence = () =>
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

test('a handler that mutates nothing writes nothing', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  const before = await readFile(join(cwd, 'tokens/core.json'), 'utf8');
  const out = silence();

  const code = await runContributed({
    project,
    command: { name: 'demo noop', description: 'x', run: () => {} },
    args: {},
    options: {},
  });

  out.mockRestore();
  expect(code).toBe(0);
  expect(await readFile(join(cwd, 'tokens/core.json'), 'utf8')).toBe(before);
});

test('a handler that mutates the document has its change written', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  const out = silence();

  const code = await runContributed({
    project,
    command: {
      name: 'demo rename',
      description: 'x',
      run: (ctx) => {
        (ctx.project as typeof project).document.apply(
          renamePath(['color', 'red', '900'], ['color', 'red', '950']),
        );
      },
    },
    args: {},
    options: {},
  });

  out.mockRestore();
  expect(code).toBe(0);
  const light = await readFile(join(cwd, 'tokens/light.json'), 'utf8');
  expect(light).toContain('{color.red.950}');
});

test('declared file artifacts are written by the runner, relative to the project', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  const out = silence();

  const code = await runContributed({
    project,
    command: {
      name: 'demo emit',
      description: 'x',
      run: () => ({ files: [{ path: 'schemas/built.json', content: '{}\n' }] }),
    },
    args: {},
    options: {},
  });

  out.mockRestore();
  expect(code).toBe(0);
  expect(await readFile(join(cwd, 'schemas/built.json'), 'utf8')).toBe('{}\n');
});

test('--dry-run lists artifacts without writing; --json carries them', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  let output = '';
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
    output += s;
    return true;
  });

  const code = await runContributed({
    project,
    command: {
      name: 'demo emit',
      description: 'x',
      run: () => ({ files: [{ path: 'schemas/built.json', content: '{}\n' }] }),
    },
    args: {},
    options: { dryRun: true, json: true },
  });

  out.mockRestore();
  expect(code).toBe(0);
  expect(JSON.parse(output).files).toContain('schemas/built.json');
  await expect(
    readFile(join(cwd, 'schemas/built.json'), 'utf8'),
  ).rejects.toThrow();
});

test('an artifact path escaping the working directory is refused with exit 2', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  const out = silence();
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  const code = await runContributed({
    project,
    command: {
      name: 'demo escape',
      description: 'x',
      run: () => ({ files: [{ path: '../outside.json', content: 'x' }] }),
    },
    args: {},
    options: {},
  });

  out.mockRestore();
  err.mockRestore();
  expect(code).toBe(2);
});

test('a handler that throws exits 1 and writes nothing', async () => {
  const cwd = await exampleFixture('vtk-run-');
  const project = await loadProject(cwd);
  const before = await readFile(join(cwd, 'tokens/core.json'), 'utf8');
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  const code = await runContributed({
    project,
    command: {
      name: 'demo boom',
      description: 'x',
      run: () => {
        throw new Error('nope');
      },
    },
    args: {},
    options: {},
  });

  err.mockRestore();
  expect(code).toBe(1);
  expect(await readFile(join(cwd, 'tokens/core.json'), 'utf8')).toBe(before);
});
