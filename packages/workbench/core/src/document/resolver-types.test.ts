import { expect, test } from 'vitest';
import { emptyResolver } from './resolver-types';

test('emptyResolver is a valid empty 2025.10 document', () => {
  expect(emptyResolver()).toEqual({
    version: '2025.10',
    sets: {},
    modifiers: {},
    resolutionOrder: [],
  });
});

test('emptyResolver returns a fresh object each call (no shared refs)', () => {
  const a = emptyResolver();
  const b = emptyResolver();
  a.sets.foo = { sources: [] };
  expect(b.sets).toEqual({});
});
