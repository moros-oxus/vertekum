import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { controlKind, enumOptions } from './controlKind';

describe('controlKind', () => {
  test('boolean → checkbox (even wrapped in .default())', () => {
    expect(controlKind(z.boolean().default(false))).toBe('checkbox');
  });
  test('enum → select', () => {
    expect(
      controlKind(z.enum(['comfortable', 'compact']).default('comfortable')),
    ).toBe('select');
  });
  test('number → number', () => {
    expect(controlKind(z.number().default(0))).toBe('number');
  });
  test('string → text', () => {
    expect(controlKind(z.string().default(''))).toBe('text');
  });
  test('enumOptions returns the enum values (unwrapping .default())', () => {
    expect(
      enumOptions(z.enum(['comfortable', 'compact']).default('comfortable')),
    ).toEqual(['comfortable', 'compact']);
  });
  test('enumOptions is empty for non-enums', () => {
    expect(enumOptions(z.boolean())).toEqual([]);
  });
});
