import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SKILL_STAMP } from '../templates/index';
import { runInit } from './init';

const TOKENS_SKILL = '.claude/skills/vertekum/tokens/SKILL.md';
const RELEASE_SKILL = '.claude/skills/vertekum/release/SKILL.md';

test('init scaffolds a config, a seed set, a resolver, and the skill set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  const code = await runInit({ dir });

  expect(code).toBe(0);
  expect(existsSync(join(dir, 'vertekum.config.ts'))).toBe(true);
  expect(existsSync(join(dir, 'tokens/core.json'))).toBe(true);
  expect(existsSync(join(dir, 'tokens/default.resolver.json'))).toBe(true);
  expect(existsSync(join(dir, TOKENS_SKILL))).toBe(true);
  expect(existsSync(join(dir, RELEASE_SKILL))).toBe(true);
  expect(readFileSync(join(dir, TOKENS_SKILL), 'utf8')).toContain(SKILL_STAMP);
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

test('init can skip the skills', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  await runInit({ dir, skill: false });
  expect(existsSync(join(dir, TOKENS_SKILL))).toBe(false);
  expect(existsSync(join(dir, RELEASE_SKILL))).toBe(false);
});

test('skill-only refresh rewrites stamped skills and touches nothing else', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  await runInit({ dir });
  writeFileSync(join(dir, 'vertekum.config.ts'), '// mine');
  writeFileSync(join(dir, TOKENS_SKILL), `stale\n${SKILL_STAMP}\n`);

  expect(await runInit({ dir, skillOnly: true })).toBe(0);
  expect(readFileSync(join(dir, TOKENS_SKILL), 'utf8')).not.toContain('stale');
  expect(readFileSync(join(dir, 'vertekum.config.ts'), 'utf8')).toBe('// mine');
});

test('skill-only refresh works where no project exists', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  expect(await runInit({ dir, skillOnly: true })).toBe(0);
  expect(existsSync(join(dir, TOKENS_SKILL))).toBe(true);
  expect(existsSync(join(dir, 'vertekum.config.ts'))).toBe(false);
});

test('a stampless (edited) skill is never overwritten', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-init-'));
  await runInit({ dir });
  writeFileSync(join(dir, TOKENS_SKILL), '# my own instructions\n');

  expect(await runInit({ dir, skillOnly: true })).toBe(0);
  expect(readFileSync(join(dir, TOKENS_SKILL), 'utf8')).toBe(
    '# my own instructions\n',
  );
  // The stamped sibling is still refreshed.
  expect(readFileSync(join(dir, RELEASE_SKILL), 'utf8')).toContain(SKILL_STAMP);
});
