import { expect, test } from 'vitest';
import { addResolver, removeResolver, updateResolver } from './commands';
import { emptyResolver } from './resolver-types';

test('addResolver defaults to an empty document', () => {
  expect(addResolver('acme')).toEqual({
    type: 'addResolver',
    name: 'acme',
    doc: emptyResolver(),
  });
});

test('addResolver accepts an explicit document', () => {
  const doc = { ...emptyResolver(), name: 'Acme' };
  expect(addResolver('acme', doc)).toEqual({
    type: 'addResolver',
    name: 'acme',
    doc,
  });
});

test('removeResolver / updateResolver carry name (+ doc)', () => {
  expect(removeResolver('acme')).toEqual({
    type: 'removeResolver',
    name: 'acme',
  });
  const doc = emptyResolver();
  expect(updateResolver('acme', doc)).toEqual({
    type: 'updateResolver',
    name: 'acme',
    doc,
  });
});
