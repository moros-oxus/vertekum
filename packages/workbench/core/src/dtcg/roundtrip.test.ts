import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { updateTokenValue } from '../document/commands';
import { createDocument } from '../document/document';
import type { DtcgNode } from './parse';

/**
 * The acceptance test for the raw-document model: reading a collection and writing it back with no
 * mutation loses nothing.
 *
 * It failed before this arc. The old writer rebuilt each file from a flat `Token[]`, so a group's
 * `$type` was flattened onto its children, a group's `$description` and `$extensions` were deleted,
 * and identity was injected into every token. A file could not survive its own round trip.
 *
 * ONE THING IS NOT PRESERVED, and it is a JavaScript rule rather than a choice: a plain object
 * orders integer-like keys first, ascending, before any string key. So a group mixing numeric member
 * names with `$`-prefixed ones — `{ $type, 1, 2, 3 }`, the shape of every scale — comes back as
 * `{ 1, 2, 3, $type }` the moment it passes through `JSON.parse`. No data is lost and DTCG attaches
 * no meaning to key order, but the first write of such a file produces a diff. Preserving order
 * exactly would mean abandoning plain objects for the tree; the last test here pins the behaviour so
 * it is a known property rather than a surprise.
 */

function collection(dir: string): Record<string, DtcgNode> {
  const files: Record<string, DtcgNode> = {};
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.json')) {
      files[name] = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    }
  }
  return files;
}

test.each([
  ['examples/unabridged/tokens'],
  ['examples/agentic/tokens'],
  ['packages/ui-system/primitives/tokens'],
])('%s round-trips with no data loss', (dir) => {
  const source = collection(join(process.cwd(), dir));
  expect(Object.keys(source).length).toBeGreaterThan(0);

  const document = createDocument();
  document.hydrate(source);

  expect(document.getFiles()).toEqual(source);
});

const AWKWARD: Record<string, DtcgNode> = {
  'core.json': {
    $schema: 'https://example.test/dtcg.json',
    space: {
      $type: 'dimension',
      $description: 'Spacing scale',
      $extensions: {
        // The shape a pattern-creator will take: a group declaring its own members.
        'org.vertekum.scale': { base: 4, factor: 2, unit: 'px' },
        'com.example.vendor': { anything: true },
      },
      '1': {
        $value: '4px',
        // A retired ident already on disk: inert, and preserved because nothing transforms it.
        $extensions: { 'org.vertekum.ident': 'vtk-legacy' },
      },
      '2': { $value: '8px' },
    },
  },
  'default.resolver.json': {
    version: '2025.10',
    name: 'default',
    $extensions: { 'com.example.vendor': { note: 'kept' } },
    sets: { core: { sources: [{ $ref: 'core.json' }] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/core' }],
  },
};

test('group metadata, vendor keys, $schema, and inert idents all survive', () => {
  const document = createDocument();
  document.hydrate(structuredClone(AWKWARD));

  expect(document.getFiles()).toEqual(AWKWARD);
});

test('a mutation writes only what changed', () => {
  const document = createDocument();
  document.hydrate(structuredClone(AWKWARD));

  document.apply(updateTokenValue('core:space.1', '6px'));

  const core = document.getFiles()['core.json'] as DtcgNode;
  const space = core.space as DtcgNode;

  // The edited value moved…
  expect((space['1'] as DtcgNode).$value).toBe('6px');
  // …and nothing else did.
  expect(space.$type).toBe('dimension');
  expect(space.$description).toBe('Spacing scale');
  expect(space.$extensions).toEqual({
    'org.vertekum.scale': { base: 4, factor: 2, unit: 'px' },
    'com.example.vendor': { anything: true },
  });
  expect((space['1'] as DtcgNode).$extensions).toEqual({
    'org.vertekum.ident': 'vtk-legacy',
  });
  expect(space['2']).toEqual({ $value: '8px' });
  expect(core.$schema).toBe('https://example.test/dtcg.json');
  expect(document.getFiles()['default.resolver.json']).toEqual(
    AWKWARD['default.resolver.json'],
  );
});

test('undo restores the file exactly', () => {
  const document = createDocument();
  document.hydrate(structuredClone(AWKWARD));

  document.apply(updateTokenValue('core:space.1', '6px'));
  document.undo();

  expect(document.getFiles()).toEqual(AWKWARD);
});

test('integer-like keys normalize to the front — a JS object rule, not data loss', () => {
  const source: Record<string, DtcgNode> = {
    'core.json': {
      space: {
        $type: 'dimension',
        '1': { $value: '4px' },
        '2': { $value: '8px' },
      },
    },
  };

  const document = createDocument();
  document.hydrate(structuredClone(source));

  // Content is identical…
  expect(document.getFiles()).toEqual(source);

  // …but the authored key order is not recoverable, because `JSON.parse` already lost it.
  expect(
    Object.keys(
      (document.getFiles()['core.json'] as DtcgNode).space as DtcgNode,
    ),
  ).toEqual(['1', '2', '$type']);
});

test('$ref tokens and value-position pointers survive an untouched round trip', () => {
  const source: Record<string, DtcgNode> = {
    'core.json': {
      base: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
      },
      alias: { $ref: '#/base' },
      wrapped: { $value: { $ref: '#/base/$value' } },
    },
  };
  const document = createDocument();
  document.hydrate(structuredClone(source));
  expect(document.getFiles()).toEqual(source);
});

test('editing a neighbour leaves a $ref node alone, with its authored notation', () => {
  const document = createDocument();
  document.hydrate({
    'core.json': {
      base: { $value: 4 },
      alias: { $ref: '#/base' },
      wrapped: { $value: { $ref: '#/base/$value' } },
    },
  });
  const base = document.getAllTokens().find((t) => t.path.join('.') === 'base');
  document.apply(updateTokenValue(String(base?.id), 7));

  const core = document.getFiles()['core.json'] as Record<string, unknown>;
  expect(core.base).toEqual({ $value: 7 });
  expect(core.alias).toEqual({ $ref: '#/base' });
  expect(core.wrapped).toEqual({ $value: { $ref: '#/base/$value' } });
  // and the model re-derived the materialized values
  const alias = document
    .getAllTokens()
    .find((t) => t.path.join('.') === 'alias');
  expect(alias?.value).toBe(7);
});
