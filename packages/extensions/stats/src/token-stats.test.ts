import type { Token } from 'vertekum';
import { expect, test } from 'vitest';
import { computeTokenStats } from './token-stats';

const token = (path: string[]): Token => ({
  id: path.join('.'),
  path,
  type: 'color',
  value: '#000',
});

test('counts tokens and distinct parent groups', () => {
  const stats = computeTokenStats([
    token(['color', 'red']),
    token(['color', 'blue']),
    token(['size', 'sm']),
  ]);
  expect(stats.tokens).toBe(3);
  expect(stats.groups).toBe(2); // "color", "size"
});
