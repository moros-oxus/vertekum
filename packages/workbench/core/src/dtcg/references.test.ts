import { expect, test } from 'vitest';
import type { Token } from '../document/types';
import {
  flatten,
  indexByPath,
  isReference,
  referenceToPath,
  resolveValue,
} from './references';

const tok = (path: string[], value: unknown, set = 's'): Token => ({
  id: path.join('.'),
  path,
  type: 'color',
  value,
  set,
});

test('isReference recognizes brace-wrapped references, rejects the rest', () => {
  expect(isReference('{color.brand.primary}')).toBe(true);
  expect(isReference('  {a.b}  ')).toBe(true); // tolerates surrounding whitespace
  expect(isReference('#ff0000')).toBe(false);
  expect(isReference('16px')).toBe(false);
  expect(isReference('{}')).toBe(false); // too short
  expect(isReference('{foo')).toBe(false);
  expect(isReference('foo}')).toBe(false);
  expect(isReference(16)).toBe(false);
  expect(isReference(null)).toBe(false);
  expect(isReference(undefined)).toBe(false);
});

test('referenceToPath returns the bare path for references, else empty', () => {
  expect(referenceToPath('{color.brand}')).toBe('color.brand');
  expect(referenceToPath('#f00')).toBe('');
  expect(referenceToPath('')).toBe('');
  expect(referenceToPath('{}')).toBe('');
  expect(referenceToPath(null)).toBe('');
});

test('resolveValue follows a reference chain; undefined on dangling/cycle', () => {
  const brand = tok(['color', 'brand'], '#f00');
  const primary = tok(['color', 'primary'], '{color.brand}');
  const idx = indexByPath([brand, primary]);
  expect(resolveValue(primary, idx)).toBe('#f00');
  expect(
    resolveValue(tok(['x'], '{missing}'), indexByPath([])),
  ).toBeUndefined();
  const a = tok(['a'], '{b}');
  const b = tok(['b'], '{a}');
  expect(resolveValue(a, indexByPath([a, b]))).toBeUndefined();
});

test('flatten derefs resolvable refs and keeps unresolvable ones as-is', () => {
  const brand = tok(['color', 'brand'], '#f00');
  const primary = tok(['color', 'primary'], '{color.brand}');
  const dangling = tok(['color', 'ghost'], '{nope}');
  const out = flatten([brand, primary, dangling]);
  expect(out.map((t) => t.value)).toEqual(['#f00', '#f00', '{nope}']);
});
