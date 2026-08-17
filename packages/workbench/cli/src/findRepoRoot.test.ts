import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findRepoRoot } from './findRepoRoot';

test('stops at the nearest ancestor containing .git', () => {
  const root = mkdtempSync(join(tmpdir(), 'vtk-'));
  mkdirSync(join(root, '.git'));
  const nested = join(root, 'packages', 'app');
  mkdirSync(nested, { recursive: true });
  expect(findRepoRoot(nested)).toBe(root);
});

test('stops at pnpm-workspace.yaml', () => {
  const root = mkdtempSync(join(tmpdir(), 'vtk-'));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n');
  const nested = join(root, 'examples', 'default');
  mkdirSync(nested, { recursive: true });
  expect(findRepoRoot(nested)).toBe(root);
});

test('falls back to the starting dir when no marker is found', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-'));
  expect(findRepoRoot(dir)).toBe(dir);
});
