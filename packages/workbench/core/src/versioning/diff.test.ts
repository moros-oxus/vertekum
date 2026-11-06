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

describe('deprecation', () => {
  test('a newly deprecated token is its own change (patch), carrying the reason', () => {
    const changes = diffTokens(
      [tok('a', ['color', 'old'], '#000')],
      [tok('a', ['color', 'old'], '#000', { deprecated: 'Use {color.new}' })],
    );
    expect(changes).toEqual([
      {
        kind: 'deprecated',
        id: 'a',
        path: ['color', 'old'],
        deprecated: 'Use {color.new}',
      },
    ]);
    expect(suggestBump(changes)).toBe('patch');
  });

  test('a value change and a deprecation in one release are both reported', () => {
    const changes = diffTokens(
      [tok('a', ['color', 'old'], '#000')],
      [tok('a', ['color', 'old'], '#111', { deprecated: true })],
    );
    expect(changes.map((c) => c.kind).sort()).toEqual([
      'changed',
      'deprecated',
    ]);
  });

  test('an un-deprecated or re-worded deprecation is a change, not a deprecation', () => {
    const undone = diffTokens(
      [tok('a', ['x'], '#000', { deprecated: true })],
      [tok('a', ['x'], '#000')],
    );
    expect(undone).toEqual([
      {
        kind: 'changed',
        id: 'a',
        path: ['x'],
        fields: { value: false, description: false, deprecation: true },
      },
    ]);
    const still = diffTokens(
      [tok('a', ['x'], '#000', { deprecated: true })],
      [tok('a', ['x'], '#000', { deprecated: true })],
    );
    expect(still).toEqual([]);
  });
});
