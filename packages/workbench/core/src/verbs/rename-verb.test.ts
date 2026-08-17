import { expect, test } from 'vitest';
import { createDocument } from '../document/document';
import type { CommandResult } from '../shell/types';
import { serializeDocument } from '../storage/provider';
import { tokenVerbs } from './token-verbs';

/**
 * Moved from `@vertekum/ext-tokens` when `token rename` relocated to core. Behaviour is unchanged,
 * so this coverage travels with the verb rather than being rewritten.
 */
const rename = tokenVerbs.find((v) => v.name === 'token rename');
if (!rename) throw new Error('token rename is missing from tokenVerbs');

function ctx(from: string, to: string, options: Record<string, unknown> = {}) {
  const document = createDocument();
  document.hydrate(
    serializeDocument(
      [
        {
          id: 'c1',
          path: ['color', 'red', '100'],
          type: 'color',
          value: '#fee2e2',
          set: 'core',
        },
        {
          id: 'c2',
          path: ['color', 'red', '900'],
          type: 'color',
          value: '#7f1d1d',
          set: 'core',
        },
        {
          id: 'l1',
          path: ['color', 'brand', 'primary'],
          type: 'color',
          value: '{color.red.900}',
          set: 'light',
        },
      ],
      ['core', 'light'],
    ),
  );
  return { project: { document }, args: { from, to }, options };
}

test('renames a leaf and reports what moved', () => {
  const c = ctx('color.red.900', 'color.red.950');
  const result = rename.run(c) as CommandResult;
  const tokens = c.project.document.getAllTokens();
  const paths = tokens.map((t) => t.path.join('.'));

  // Identity is (set, path), so a renamed token has a new id — assert on where things ARE.
  expect(paths).toContain('color.red.950');
  expect(paths).not.toContain('color.red.900');
  expect(
    tokens.find((t) => t.path.join('.') === 'color.brand.primary')?.value,
  ).toBe('{color.red.950}');
  expect(result.summary).toMatch(/color\.red\.900.*color\.red\.950/);
});

test('refuses a path that matches nothing', () => {
  expect(() => rename.run(ctx('color.nope', 'color.other'))).toThrow(
    /no token or group at 'color.nope'/,
  );
});

test('refuses a group without --allow-group, naming the count', () => {
  expect(() => rename.run(ctx('color.red', 'color.danger'))).toThrow(
    /group \(2 tokens\)[\s\S]*--allow-group/,
  );
});

test('renames a group when allowed', () => {
  const c = ctx('color.red', 'color.danger', { allowGroup: true });
  rename.run(c);
  const tokens = c.project.document.getAllTokens();
  const paths = tokens.map((t) => t.path.join('.'));

  expect(paths).toContain('color.danger.100');
  expect(paths).toContain('color.danger.900');
  expect(
    tokens.find((t) => t.path.join('.') === 'color.brand.primary')?.value,
  ).toBe('{color.danger.900}');
});

test('refuses a colliding rename, naming the collision', () => {
  expect(() => rename.run(ctx('color.red.900', 'color.red.100'))).toThrow(
    /color\.red\.100/,
  );
});
