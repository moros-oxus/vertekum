import { dtcg, type Token } from 'vertekum';
import { describe, expect, test } from 'vitest';
import { referenceCandidates, validateReference } from './resolve-value';

const { indexByPath } = dtcg.tokens;

function tok(path: string[], value: unknown): Token {
  return {
    id: path.join('.'),
    path,
    type: 'color',
    value,
  };
}

describe('referenceCandidates', () => {
  test('returns same-type paths, sorted, excluding self and other types', () => {
    const brand = tok(['color', 'brand'], '#f00');
    const accent = tok(['color', 'accent'], '#0f0');
    const space = tok(['space', 'sm'], '4px');
    space.type = 'dimension';
    const self = tok(['color', 'primary'], '#00f');

    expect(
      referenceCandidates([brand, accent, space, self], 'color', self.id),
    ).toEqual(['color.accent', 'color.brand']);
  });
});

describe('validateReference', () => {
  test('returns null for a non-reference value', () => {
    const t = tok(['color', 'primary'], '#f00');
    expect(
      validateReference('#f00', 'color', t.id, indexByPath([t])),
    ).toBeNull();
  });

  test('returns null for a valid same-type reference', () => {
    const brand = tok(['color', 'brand'], '#f00');
    const primary = tok(['color', 'primary'], '{color.brand}');
    const index = indexByPath([brand, primary]);
    expect(
      validateReference('{color.brand}', 'color', primary.id, index),
    ).toBeNull();
  });

  test('flags a dangling target', () => {
    const primary = tok(['color', 'primary'], '{no.such}');
    expect(
      validateReference(
        '{no.such}',
        'color',
        primary.id,
        indexByPath([primary]),
      ),
    ).toBe('dangling');
  });

  test('flags a self-reference as a cycle', () => {
    const a = tok(['a'], '{a}');
    expect(validateReference('{a}', 'color', a.id, indexByPath([a]))).toBe(
      'cycle',
    );
  });

  test('flags a two-node cycle', () => {
    const a = tok(['a'], '{b}');
    const b = tok(['b'], '{a}');
    expect(validateReference('{b}', 'color', a.id, indexByPath([a, b]))).toBe(
      'cycle',
    );
  });

  test('flags a type mismatch', () => {
    const brand = tok(['brand'], '4px');
    brand.type = 'dimension';
    const primary = tok(['color', 'primary'], '{brand}');
    expect(
      validateReference(
        '{brand}',
        'color',
        primary.id,
        indexByPath([brand, primary]),
      ),
    ).toBe('type-mismatch');
  });
});
