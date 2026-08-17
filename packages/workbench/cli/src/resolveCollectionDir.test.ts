import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { resolveCollectionDir } from './resolveCollectionDir';

test('defaults to <cwd>/tokens when no collection is set', () => {
  expect(resolveCollectionDir(undefined, undefined, '/proj')).toBe(
    resolve('/proj/tokens'),
  );
  expect(resolveCollectionDir({}, '/proj/vertekum.config.ts', '/proj')).toBe(
    resolve('/proj/tokens'),
  );
});

test('resolves a relative collection against the config file dir', () => {
  expect(
    resolveCollectionDir(
      { collection: './tokens' },
      '/proj/vertekum.config.ts',
      '/proj',
    ),
  ).toBe(resolve('/proj/tokens'));
  expect(
    resolveCollectionDir(
      { collection: 'design/tokens' },
      '/proj/cfg/vertekum.config.ts',
      '/proj',
    ),
  ).toBe(resolve('/proj/cfg/design/tokens'));
});

test('passes an absolute collection through', () => {
  expect(
    resolveCollectionDir(
      { collection: '/abs/tokens' },
      '/proj/vertekum.config.ts',
      '/proj',
    ),
  ).toBe('/abs/tokens');
});
