import { createDocument, serializeDocument, type Token } from '@vertekum/core';
import { expect, test } from 'vitest';
import { runMigrate } from './migrate';

function projectWith(tokens: Token[]) {
  const document = createDocument();
  document.hydrate(serializeDocument(tokens, ['core'], new Map()));
  return {
    document,
    valueOptions: { colorSpace: 'oklch' },
    // saveProject is reached only on real runs with conversions; these tests stay dry
  } as never;
}

const token = (path: string[], type: string, value: unknown): Token => ({
  id: `core:${path.join('.')}`,
  path,
  type,
  value,
  set: 'core',
});

test('migrate converts strings by effective type, skips refs, reports unparseables', async () => {
  const project = projectWith([
    token(['color', 'base'], 'color', '#ff00ff'),
    token(['color', 'alias'], 'color', '{color.base}'),
    token(['color', 'odd'], 'color', 'not-a-colour'),
    token(['space', 'sm'], 'dimension', '4px'),
    token(['font', 'w'], 'fontWeight', 'bold'), // not a migratable type
  ]);

  const lines: string[] = [];
  const code = await runMigrate({
    project,
    dryRun: true,
    write: (l) => lines.push(l),
  });

  const out = lines.join('\n');
  expect(out).toContain('color.base');
  expect(out).toContain('space.sm');
  expect(out).toContain('cannot parse core:color.odd');
  expect(out).toContain('would convert 2, references skipped 1, unparseable 1');
  expect(code).toBe(1); // unparseables surface in the exit code

  // dry run wrote nothing
  const document = (project as { document: { getAllTokens(): Token[] } })
    .document;
  expect(
    document.getAllTokens().find((t) => t.path.join('.') === 'color.base')
      ?.value,
  ).toBe('#ff00ff');
});

test('a second (real) run is idempotent: nothing left to convert', async () => {
  const project = projectWith([
    token(['color', 'base'], 'color', {
      colorSpace: 'oklch',
      components: [0.7017, 0.3225, 328.3634],
      alpha: 1,
      hex: '#ff00ff',
    }),
  ]);

  const lines: string[] = [];
  const code = await runMigrate({
    project,
    dryRun: true,
    write: (l) => lines.push(l),
  });
  expect(code).toBe(0);
  expect(lines.join('\n')).toContain('would convert 0');
});

test('migrate values never touches pointer tokens', async () => {
  const document = createDocument();
  document.hydrate({
    'core.json': {
      size: { $type: 'dimension', $value: '4px' },
      alias: { $type: 'dimension', $ref: '#/size' },
    },
  });
  const project = { document, valueOptions: { colorSpace: 'oklch' } } as never;

  const lines: string[] = [];
  const code = await runMigrate({
    project,
    dryRun: true,
    write: (l) => lines.push(l),
  });

  expect(code).toBe(0);
  // only the stored string converts; the pointer token's derived '4px' is untouched
  expect(lines.join('\n')).toContain('would convert 1');
  expect(lines.join('\n')).not.toContain('alias');
});
