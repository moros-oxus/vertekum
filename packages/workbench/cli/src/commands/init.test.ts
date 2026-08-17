import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runInit } from './init';

test('init scaffolds a config, a seed set, a resolver, and the skill', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  const code = await runInit({ dir });

  expect(code).toBe(0);
  expect(existsSync(join(dir, 'vertekum.config.ts'))).toBe(true);
  expect(existsSync(join(dir, 'tokens/core.json'))).toBe(true);
  expect(existsSync(join(dir, 'tokens/default.resolver.json'))).toBe(true);
  expect(existsSync(join(dir, '.claude/skills/vertekum-tokens/SKILL.md'))).toBe(
    true,
  );
});

test('the scaffolded resolver names the scaffolded set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  await runInit({ dir });

  const resolver = JSON.parse(
    readFileSync(join(dir, 'tokens/default.resolver.json'), 'utf8'),
  );
  expect(resolver.version).toBe('2025.10');
  expect(resolver.sets.core.sources).toEqual([{ $ref: 'core.json' }]);
  expect(resolver.resolutionOrder).toEqual([{ $ref: '#/sets/core' }]);
});

test('init refuses to overwrite an existing config unless forced', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  writeFileSync(join(dir, 'vertekum.config.ts'), '// mine');

  expect(await runInit({ dir })).toBe(1);
  expect(readFileSync(join(dir, 'vertekum.config.ts'), 'utf8')).toBe('// mine');

  expect(await runInit({ dir, force: true })).toBe(0);
  expect(readFileSync(join(dir, 'vertekum.config.ts'), 'utf8')).not.toBe(
    '// mine',
  );
});

test('init can skip the skill', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  await runInit({ dir, skill: false });
  expect(existsSync(join(dir, '.claude/skills/vertekum-tokens/SKILL.md'))).toBe(
    false,
  );
});
