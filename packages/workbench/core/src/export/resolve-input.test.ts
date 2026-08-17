import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import { resolveExporterInput } from './resolve-input';

const t = (path: string[], value: unknown, set: string): Token => ({
  id: `${set}:${path.join('.')}`,
  path,
  type: 'color',
  value,
  set,
});
const resolver: ResolverDocument = {
  version: '2025.10',
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
const tokens: Token[] = [
  t(['color', 'accent'], '#f59e0b', 'core'),
  t(['color', 'bg'], '#fff', 'light'),
  t(['color', 'bg'], '#111', 'dark'),
];

test('resolveExporterInput: base = default selection; one variant per non-base context', () => {
  const input = resolveExporterInput(resolver, tokens);
  expect(input.base.find((x) => x.path.join('.') === 'color.bg')?.value).toBe(
    '#fff',
  );
  expect(input.variants).toHaveLength(1);
  expect(input.variants[0]).toMatchObject({
    modifier: 'theme',
    context: 'dark',
  });
  expect(
    input.variants[0]?.tokens.find((x) => x.path.join('.') === 'color.bg')
      ?.value,
  ).toBe('#111');
  expect(input.resolver).toBe(resolver);
  expect(input.tokens).toBe(tokens);
});
