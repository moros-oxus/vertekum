import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findConfig } from './findConfig';

test('finds vertekum.config.ts in the directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-'));
  const path = join(dir, 'vertekum.config.ts');
  writeFileSync(path, 'export default {};');
  expect(findConfig(dir)).toBe(path);
});

test('returns undefined when no config exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-'));
  expect(findConfig(dir)).toBeUndefined();
});

test('walks up to find a config in an ancestor directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'vtk-'));
  const path = join(root, 'vertekum.config.ts');
  writeFileSync(path, 'export default {};');
  const nested = join(root, 'a', 'b');
  mkdirSync(nested, { recursive: true });
  expect(findConfig(nested)).toBe(path);
});
