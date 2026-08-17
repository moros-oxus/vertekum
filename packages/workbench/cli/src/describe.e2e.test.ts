import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

test('describe reports the live inventory', async () => {
  const cwd = await exampleFixture('vtk-describe-');
  const { stdout } = await run('node', [bin, 'describe', '--json'], { cwd });
  const info = JSON.parse(stdout);

  expect(info.project.collectionDir.endsWith('tokens')).toBe(true);
  expect(info.extensions.map((e: { id: string }) => e.id)).toContain(
    'vtk.export',
  );
  expect(info.exporters.map((e: { id: string }) => e.id)).toContain('css');
  expect(info.validators.map((v: { id: string }) => v.id)).toContain(
    'core.references',
  );
  expect(info.commands.map((c: { name: string }) => c.name)).toContain(
    'token rename',
  );
  expect(info.compositions[0].name).toBe('default');
  expect(info.compositions[0].modifiers.theme.contexts).toEqual([
    'light',
    'dark',
  ]);
  expect(info.routes).toBeUndefined();
}, 60_000);
