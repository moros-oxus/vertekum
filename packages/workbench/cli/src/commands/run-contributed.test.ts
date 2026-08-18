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
