import { dtcg } from 'vertekum';
import { expect, test } from 'vitest';
import { pathToReference } from './references';

test('pathToReference wraps a path but never yields a bare {}', () => {
  expect(pathToReference('color.brand')).toBe('{color.brand}');
  expect(pathToReference('')).toBe('');
  expect(pathToReference('   ')).toBe('');
});

test('round-trips a path through wrap → unwrap (unwrap via dtcg.tokens)', () => {
  expect(dtcg.tokens.referenceToPath(pathToReference('color.accent'))).toBe(
    'color.accent',
  );
});
