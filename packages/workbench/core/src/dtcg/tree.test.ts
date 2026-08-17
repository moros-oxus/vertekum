import { expect, test } from 'vitest';
import type { DtcgNode } from './parse';
import { deleteNodeAt, getNodeAt, isTokenNode, setNodeAt } from './tree';

const tree = (): DtcgNode => ({
  color: {
    $type: 'color',
    $description: 'Palette',
    $extensions: { 'org.vertekum.scale': { base: 4 } },
    brand: { primary: { $value: '#c8102e' } },
  },
});

test('isTokenNode distinguishes a token from a group', () => {
  expect(isTokenNode({ $value: '#fff' })).toBe(true);
  expect(isTokenNode({ $type: 'color', a: {} })).toBe(false);
});

test('getNodeAt reads at depth and reports a missing path', () => {
  expect(getNodeAt(tree(), ['color', 'brand', 'primary'])).toEqual({
    $value: '#c8102e',
  });
  expect(getNodeAt(tree(), ['color', 'nope'])).toBeUndefined();
  expect(
    getNodeAt(tree(), ['color', 'brand', 'primary', 'deeper']),
  ).toBeUndefined();
});

test('setNodeAt creates intermediate groups without disturbing existing ones', () => {
  const t = tree();
  setNodeAt(t, ['space', 'scale', '1'], { $value: '4px' });
  setNodeAt(t, ['color', 'brand', 'secondary'], { $value: '#000' });

  expect(getNodeAt(t, ['space', 'scale', '1'])).toEqual({ $value: '4px' });
  expect(getNodeAt(t, ['color', 'brand', 'primary'])).toEqual({
    $value: '#c8102e',
  });
  // The group's own declarations are untouched by a write beneath it.
  expect((t.color as DtcgNode).$type).toBe('color');
  expect((t.color as DtcgNode).$extensions).toEqual({
    'org.vertekum.scale': { base: 4 },
  });
});

test('deleteNodeAt removes the token and leaves the group declaration intact', () => {
  const t = tree();
  deleteNodeAt(t, ['color', 'brand', 'primary']);

  expect(getNodeAt(t, ['color', 'brand', 'primary'])).toBeUndefined();
  // Not pruned: a group can carry a pattern, and pruning would discard what the author wrote.
  expect(getNodeAt(t, ['color', 'brand'])).toEqual({});
  expect((t.color as DtcgNode).$description).toBe('Palette');
  expect((t.color as DtcgNode).$extensions).toEqual({
    'org.vertekum.scale': { base: 4 },
  });
});

test('deleteNodeAt on a missing path is a no-op', () => {
  const t = tree();
  deleteNodeAt(t, ['nope', 'nothing']);
  expect(t).toEqual(tree());
});
