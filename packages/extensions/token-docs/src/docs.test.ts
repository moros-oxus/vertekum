import { expect, test } from 'vitest';
import { DOCS_KEY, docsOf, docsOfNode, withNote } from './docs';

const token = (extensions?: Record<string, unknown>) => ({
  id: 'core:color.text',
  path: ['color', 'text'],
  type: 'color',
  value: '#111111',
  ...(extensions ? { extensions } : {}),
});

test('the key is the documented one third parties read', () => {
  expect(DOCS_KEY).toBe('org.vertekum.docs');
});

test('reads notes off a token, and absent when there are none', () => {
  expect(
    docsOf(token({ [DOCS_KEY]: { docs: 'body copy', llm: 'prefer this' } })),
  ).toEqual({ docs: 'body copy', llm: 'prefer this' });
  expect(docsOf(token())).toBeUndefined();
  expect(docsOf(token({ 'com.figma.scopes': ['ALL_FILLS'] }))).toBeUndefined();
});

test('a malformed payload reads as absent rather than throwing', () => {
  // A hand-edited file must not break someone else's build — an exporter reading notes gets
  // "no notes", not an exception from inside this package.
  expect(docsOf(token({ [DOCS_KEY]: 'just a string' }))).toBeUndefined();
  expect(docsOf(token({ [DOCS_KEY]: ['a', 'b'] }))).toBeUndefined();
  expect(docsOf(token({ [DOCS_KEY]: { docs: 42 } }))).toBeUndefined();
  // Mixed: the string entries survive, the others are dropped.
  expect(docsOf(token({ [DOCS_KEY]: { docs: 'kept', llm: 7 } }))).toEqual({
    docs: 'kept',
  });
});

test('reads notes off any DTCG node, including a group', () => {
  expect(
    docsOfNode({
      $type: 'color',
      $extensions: { [DOCS_KEY]: { docs: 'all brand colour' } },
    }),
  ).toEqual({ docs: 'all brand colour' });
  expect(docsOfNode({ $type: 'color' })).toBeUndefined();
  expect(docsOfNode(undefined)).toBeUndefined();
});

test('withNote replaces one category and leaves the others alone', () => {
  const held = { docs: 'original', llm: 'keep me' };
  expect(withNote(held, 'docs', 'rewritten')).toEqual({
    docs: 'rewritten',
    llm: 'keep me',
  });
  expect(withNote(undefined, 'docs', 'first')).toEqual({ docs: 'first' });
});

test('an empty note removes that category', () => {
  expect(withNote({ docs: 'gone', llm: 'stays' }, 'docs', '')).toEqual({
    llm: 'stays',
  });
});
