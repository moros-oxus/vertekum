import { describe, expect, test } from 'vitest';
import { parseResolver, serializeResolver } from './resolver';

const full = {
  version: '2025.10',
  name: 'Acme',
  description: 'brand theme',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {
    theme: {
      contexts: {
        light: [{ $ref: 'light.json' }],
        dark: [{ $ref: 'dark.json' }],
      },
      default: 'light',
    },
  },
  resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/modifiers/theme' }],
};

describe('resolver codec', () => {
  test('parseResolver accepts a full document', () => {
    expect(parseResolver(full)).toEqual(full);
  });

  test('parseResolver defaults missing collections to empty', () => {
    expect(parseResolver({ version: '2025.10' })).toEqual({
      version: '2025.10',
      sets: {},
      modifiers: {},
      resolutionOrder: [],
    });
  });

  test('parseResolver throws on a wrong or missing version', () => {
    expect(() => parseResolver({ version: '2024.01' })).toThrow(/version/);
    expect(() => parseResolver({})).toThrow(/version/);
  });

  test('parseResolver throws when a collection has the wrong type', () => {
    expect(() => parseResolver({ version: '2025.10', sets: [] })).toThrow(
      /sets/,
    );
    expect(() =>
      parseResolver({ version: '2025.10', resolutionOrder: {} }),
    ).toThrow(/resolutionOrder/);
  });

  test('round-trip preserves pass-through keys ($schema/$defs/$extensions)', () => {
    const withPassthrough = {
      ...full,
      $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
      $defs: { foo: 1 },
      $extensions: { 'com.acme': { x: 1 } },
    };
    expect(serializeResolver(parseResolver(withPassthrough))).toEqual(
      withPassthrough,
    );
  });

  test('serializeResolver emits known keys in stable order', () => {
    expect(Object.keys(serializeResolver(parseResolver(full)))).toEqual([
      'version',
      'name',
      'description',
      'sets',
      'modifiers',
      'resolutionOrder',
    ]);
  });
});
