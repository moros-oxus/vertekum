import * as umbrella from '@vertekum/core';
import { expect, test } from 'vitest';
import * as core from './core';

test('vertekum/core re-exports the whole core surface', () => {
  expect(Object.keys(core).sort()).toEqual(Object.keys(umbrella).sort());
});
