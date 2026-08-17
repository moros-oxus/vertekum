import { describe, expect, test } from 'vitest';
import type { Token } from '../document/types';
import { diffTokens, suggestBump } from './diff';

function tok(
  id: string,
  path: string[],
  value: unknown,
  extra: Partial<Token> = {},
): Token {
  return { id, path, type: 'color', value, ...extra };
}

describe('diffTokens', () => {
  test('detects an added token (minor)', () => {
    const changes = diffTokens([], [tok('a', ['color', 'a'], '#000')]);
    expect(changes).toEqual([{ kind: 'added', id: 'a', path: ['color', 'a'] }]);
    expect(suggestBump(changes)).toBe('minor');
  });

  test('detects a removed token (major)', () => {
    const changes = diffTokens([tok('a', ['color', 'a'], '#000')], []);
    expect(changes).toEqual([
      { kind: 'removed', id: 'a', path: ['color', 'a'] },
    ]);
    expect(suggestBump(changes)).toBe('major');
  });

  test('detects a rename by stable id, not remove+add (major)', () => {
    const before = [tok('a', ['color', 'old'], '#000')];
    const after = [tok('a', ['color', 'new'], '#000')];
    expect(diffTokens(before, after)).toEqual([
      {
        kind: 'renamed',
        id: 'a',
        path: ['color', 'new'],
        fromPath: ['color', 'old'],
      },
    ]);
    expect(suggestBump(diffTokens(before, after))).toBe('major');
  });

  test('detects a retype (major)', () => {
    const before = [tok('a', ['a'], '#000')];
    const after = [tok('a', ['a'], '#000', { type: 'dimension' })];
    expect(diffTokens(before, after)).toEqual([
      { kind: 'retyped', id: 'a', path: ['a'], fromType: 'color' },
    ]);
  });

  test('detects a value change (patch) with field flags', () => {
    const before = [tok('a', ['a'], '#000')];
    const after = [tok('a', ['a'], '#111')];
    expect(diffTokens(before, after)).toEqual([
      {
        kind: 'changed',
        id: 'a',
        path: ['a'],
        fields: { value: true, description: false },
      },
    ]);
    expect(suggestBump(diffTokens(before, after))).toBe('patch');
  });

  test('no changes → empty, and suggestBump null', () => {
    const t = [tok('a', ['a'], '#000')];
    expect(diffTokens(t, t)).toEqual([]);
    expect(suggestBump([])).toBeNull();
  });

  test('picks the highest severity across a mixed set', () => {
    const before = [tok('a', ['a'], '#000'), tok('b', ['b'], '#000')];
    const after = [tok('a', ['a'], '#111'), tok('c', ['c'], '#222')];
    expect(suggestBump(diffTokens(before, after))).toBe('major');
  });
});
