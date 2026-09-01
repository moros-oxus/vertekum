import { expect, test } from 'vitest';
import { createDocument, type Document } from '../document/document';
import type { ResolverDocument } from '../document/resolver-types';
import type { CommandDescriptor } from '../shell/types';
import { serializeDocument } from '../storage/provider';
import { builtinCommands } from './index';

function newDocument(input?: {
  sets?: string[];
  resolvers?: Record<string, ResolverDocument>;
}): Document {
  const document = createDocument();
  document.hydrate(
    serializeDocument(
      [],
      input?.sets ?? ['core', 'sem', 'light', 'dark'],
      new Map(Object.entries(input?.resolvers ?? {})),
    ),
  );
  return document;
}

function verb(name: string): CommandDescriptor {
  const found = builtinCommands().find((c) => c.name === name);
  if (!found) throw new Error(`no such verb: ${name}`);
  return found;
}

async function run(
  name: string,
  document: Document,
  args: Record<string, string> = {},
  options: Record<string, unknown> = {},
): Promise<Awaited<ReturnType<CommandDescriptor['run']>>> {
  return verb(name).run({ project: { document }, args, options });
}

function resolverOf(document: Document, name: string): ResolverDocument {
  const doc = document.getResolvers().get(name);
  if (!doc) throw new Error(`no resolver ${name} in test document`);
  return doc;
}

/** The consumer shape: one resolver composing only core. */
function consumer(): Document {
  return newDocument({
    resolvers: {
      'brand-a': {
        version: '2025.10',
        sets: { core: { sources: [{ $ref: 'core.json' }] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/core' }],
      },
    },
  });
}

// ── add ──────────────────────────────────────────────────────────────────────

test('resolver add creates a resolver file; an existing name refuses; a near-miss notes', async () => {
  const document = newDocument();
  const result = await run('resolver add', document, { operand: 'brand-a' });
  expect(result?.summary).toBe('added resolver brand-a');
  expect(document.getResolvers().has('brand-a')).toBe(true);

  await expect(
    run('resolver add', document, { operand: 'brand-a' }),
  ).rejects.toThrow(/already exists/);

  const near = await run('resolver add', document, { operand: 'brand-c' });
  expect(near?.summary).toContain(
    "existing resolver 'brand-a' is 1 edit(s) away",
  );
});

test('add -s writes the entry and its order ref — the blocked consumer ask', async () => {
  const document = consumer();
  const result = await run(
    'resolver add',
    document,
    {},
    { set: 'brand-a/sem' },
  );
  expect(result?.summary).toBe('added set sem to brand-a');
  const doc = resolverOf(document, 'brand-a');
  expect(doc.sets.sem).toEqual({ sources: [{ $ref: 'sem.json' }] });
  expect(doc.resolutionOrder).toEqual([
    { $ref: '#/sets/core' },
    { $ref: '#/sets/sem' },
  ]);
});

test('add -s refuses a missing set file, an existing entry, and a stray operand', async () => {
  const document = consumer();
  await expect(
    run('resolver add', document, {}, { set: 'brand-a/nope' }),
  ).rejects.toThrow(
    /no token set file 'nope.json'.*known sets: core, sem, light, dark/,
  );
  await expect(
    run('resolver add', document, {}, { set: 'brand-a/core' }),
  ).rejects.toThrow(/already has set 'core'/);
  await expect(
    run('resolver add', document, { operand: 'huh' }, { set: 'brand-a/sem' }),
  ).rejects.toThrow(/unexpected operand 'huh'/);
});

test('add -m creates the modifier around its first context, default included', async () => {
  const document = consumer();
  const result = await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'brand-a/theme/light' },
  );
  expect(result?.summary).toContain(
    'created modifier theme with context light (default) in brand-a',
  );
  const doc = resolverOf(document, 'brand-a');
  expect(doc.modifiers.theme).toEqual({
    contexts: { light: [{ $ref: 'light.json' }] },
    default: 'light',
  });
  expect(doc.resolutionOrder.at(-1)).toEqual({ $ref: '#/modifiers/theme' });
});

test('add -m on an existing modifier adds the context; bare -m and duplicates refuse', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  await run(
    'resolver add',
    document,
    { operand: 'dark' },
    { modifier: 'theme/dark' },
  );
  const doc = resolverOf(document, 'brand-a');
  expect(Object.keys(doc.modifiers.theme?.contexts ?? {})).toEqual([
    'light',
    'dark',
  ]);
  // Still one order ref, from creation.
  expect(
    doc.resolutionOrder.filter((e) => e.$ref === '#/modifiers/theme'),
  ).toHaveLength(1);

  await expect(
    run('resolver add', document, {}, { modifier: 'brand-a/theme' }),
  ).rejects.toThrow(/needs at least one context — address one/);
  await expect(
    run(
      'resolver add',
      document,
      { operand: 'dark' },
      { modifier: 'theme/dark' },
    ),
  ).rejects.toThrow(/already has context 'dark'/);
});

test('add -m warns when a created modifier near-misses an existing sibling', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  const result = await run(
    'resolver add',
    document,
    { operand: 'dark' },
    { modifier: 'theem/dark' },
  );
  // 'theem' → 'theme' is a transposition: two edits under plain Levenshtein.
  expect(result?.summary).toContain(
    "existing modifier 'theme' is 2 edit(s) away",
  );
});

// ── remove ───────────────────────────────────────────────────────────────────

test('remove drops a resolver, a set entry with its order ref, and a modifier', async () => {
  const document = newDocument({
    resolvers: {
      'brand-a': {
        version: '2025.10',
        sets: {
          core: { sources: [{ $ref: 'core.json' }] },
          sem: { sources: [{ $ref: 'sem.json' }] },
        },
        modifiers: {
          theme: {
            contexts: {
              light: [{ $ref: 'light.json' }],
              dark: [{ $ref: 'dark.json' }],
            },
            default: 'light',
          },
        },
        resolutionOrder: [
          { $ref: '#/sets/core' },
          { $ref: '#/sets/sem' },
          { $ref: '#/modifiers/theme' },
        ],
      },
      'brand-b': {
        version: '2025.10',
        sets: {},
        modifiers: {},
        resolutionOrder: [],
      },
    },
  });

  await run('resolver remove', document, {}, { set: 'brand-a/sem' });
  let doc = resolverOf(document, 'brand-a');
  expect(doc.sets.sem).toBeUndefined();
  expect(doc.resolutionOrder).toEqual([
    { $ref: '#/sets/core' },
    { $ref: '#/modifiers/theme' },
  ]);

  await run('resolver remove', document, {}, { modifier: 'brand-a/theme' });
  doc = resolverOf(document, 'brand-a');
  expect(doc.modifiers.theme).toBeUndefined();
  expect(doc.resolutionOrder).toEqual([{ $ref: '#/sets/core' }]);

  const result = await run('resolver remove', document, { name: 'brand-b' });
  expect(result?.summary).toContain('export/unknown-composition');
  expect(document.getResolvers().has('brand-b')).toBe(false);

  await expect(
    run('resolver remove', document, { name: 'lily' }),
  ).rejects.toThrow(
    /no resolver 'lily' — did you mean 'brand-a'\?|no resolver 'lily'/,
  );
});

test('remove -m context guards: the last context and the default are refused', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  await expect(
    run('resolver remove', document, {}, { modifier: 'theme/light' }),
  ).rejects.toThrow(/last context.*remove the modifier instead/);

  await run(
    'resolver add',
    document,
    { operand: 'dark' },
    { modifier: 'theme/dark' },
  );
  await expect(
    run('resolver remove', document, {}, { modifier: 'theme/light' }),
  ).rejects.toThrow(/the default context.*retarget first/);

  await run('resolver remove', document, {}, { modifier: 'theme/dark' });
  const doc = resolverOf(document, 'brand-a');
  expect(Object.keys(doc.modifiers.theme?.contexts ?? {})).toEqual(['light']);
});

// ── push / pop ───────────────────────────────────────────────────────────────

test('push appends comma-delimited sources in order; duplicates and unknown files refuse', async () => {
  const document = consumer();
  const result = await run(
    'resolver push',
    document,
    { sources: 'sem, dark' },
    { set: 'brand-a/core' },
  );
  expect(result?.summary).toBe('pushed 2 source(s) onto brand-a/core');
  expect(resolverOf(document, 'brand-a').sets.core?.sources).toEqual([
    { $ref: 'core.json' },
    { $ref: 'sem.json' },
    { $ref: 'dark.json' },
  ]);

  await expect(
    run('resolver push', document, { sources: 'sem' }, { set: 'brand-a/core' }),
  ).rejects.toThrow(/already sources sem.json/);
  await expect(
    run(
      'resolver push',
      document,
      { sources: 'nope' },
      { set: 'brand-a/core' },
    ),
  ).rejects.toThrow(/no token set file/);
  await expect(
    run('resolver push', document, { sources: 'sem' }, {}),
  ).rejects.toThrow(/push targets a source list/);
});

test('push reaches a context source list through -m', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  await run(
    'resolver push',
    document,
    { sources: 'dark,sem' },
    { modifier: 'brand-a/theme/light' },
  );
  expect(
    resolverOf(document, 'brand-a').modifiers.theme?.contexts.light,
  ).toEqual([
    { $ref: 'light.json' },
    { $ref: 'dark.json' },
    { $ref: 'sem.json' },
  ]);
});

test('pop takes the last by default, an index, or a name — and refuses the last source', async () => {
  const document = consumer();
  await run(
    'resolver push',
    document,
    { sources: 'sem,dark,light' },
    { set: 'brand-a/core' },
  );

  await expect(
    run('resolver pop', document, { which: '9' }, { set: 'brand-a/core' }),
  ).rejects.toThrow(/out of range/);

  let result = await run('resolver pop', document, {}, { set: 'brand-a/core' });
  expect(result?.summary).toBe('popped light from brand-a/core');

  result = await run(
    'resolver pop',
    document,
    { which: '1' },
    { set: 'brand-a/core' },
  );
  expect(result?.summary).toBe('popped sem from brand-a/core');

  result = await run(
    'resolver pop',
    document,
    { which: 'dark' },
    { set: 'brand-a/core' },
  );
  expect(result?.summary).toBe('popped dark from brand-a/core');

  await expect(
    run('resolver pop', document, {}, { set: 'brand-a/core' }),
  ).rejects.toThrow(/popping the last would leave it sourcing nothing/);
});

// ── order ────────────────────────────────────────────────────────────────────

function ordered(): Document {
  return newDocument({
    resolvers: {
      'brand-a': {
        version: '2025.10',
        sets: {
          core: { sources: [{ $ref: 'core.json' }] },
          sem: { sources: [{ $ref: 'sem.json' }] },
          dark: { sources: [{ $ref: 'dark.json' }] },
        },
        modifiers: {},
        resolutionOrder: [
          { $ref: '#/sets/core' },
          { $ref: '#/sets/sem' },
          { $ref: '#/sets/dark' },
        ],
      },
    },
  });
}

test('order places by name, supports comma placements, moves, and swaps', async () => {
  let document = ordered();
  await run('resolver order', document, { target: 'brand-a', a: 'dark@{0}' });
  expect(
    resolverOf(document, 'brand-a').resolutionOrder.map((e) => e.$ref),
  ).toEqual(['#/sets/dark', '#/sets/core', '#/sets/sem']);

  document = ordered();
  await run('resolver order', document, {
    target: 'brand-a',
    a: 'dark@{0},sem@{2}',
  });
  expect(
    resolverOf(document, 'brand-a').resolutionOrder.map((e) => e.$ref),
  ).toEqual(['#/sets/dark', '#/sets/core', '#/sets/sem']);

  document = ordered();
  await run('resolver order', document, { target: 'brand-a', a: '0', b: '2' });
  expect(
    resolverOf(document, 'brand-a').resolutionOrder.map((e) => e.$ref),
  ).toEqual(['#/sets/sem', '#/sets/dark', '#/sets/core']);

  document = ordered();
  await run(
    'resolver order',
    document,
    { target: 'brand-a', a: '0', b: '2' },
    { swap: true },
  );
  expect(
    resolverOf(document, 'brand-a').resolutionOrder.map((e) => e.$ref),
  ).toEqual(['#/sets/dark', '#/sets/sem', '#/sets/core']);
});

test('order refuses bad placements, unknown names, out-of-range, and empty operands', async () => {
  const document = ordered();
  await expect(
    run('resolver order', document, { target: 'brand-a', a: 'sem@{9}' }),
  ).rejects.toThrow(/out of range/);
  await expect(
    run('resolver order', document, { target: 'brand-a', a: 'nope@{0}' }),
  ).rejects.toThrow(/no item 'nope'/);
  await expect(
    run('resolver order', document, { target: 'brand-a', a: 'sem@0' }),
  ).rejects.toThrow(/bad placement/);
  await expect(
    run('resolver order', document, { target: 'brand-a' }),
  ).rejects.toThrow(/placements .*a move .*or a swap/);
});

test('a name in both branches is ambiguous — the sets/ and modifiers/ prefixes resolve it', async () => {
  const document = newDocument({
    resolvers: {
      'brand-a': {
        version: '2025.10',
        sets: { brand: { sources: [{ $ref: 'core.json' }] } },
        modifiers: {
          brand: {
            contexts: {
              light: [{ $ref: 'light.json' }],
              dark: [{ $ref: 'dark.json' }],
            },
            default: 'light',
          },
        },
        resolutionOrder: [
          { $ref: '#/sets/brand' },
          { $ref: '#/modifiers/brand' },
        ],
      },
    },
  });
  await expect(
    run('resolver order', document, { target: 'brand-a', a: 'brand@{0}' }),
  ).rejects.toThrow(/ambiguous.*sets\/brand or modifiers\/brand/);
  await run('resolver order', document, {
    target: 'brand-a',
    a: 'modifiers/brand@{0}',
  });
  expect(
    resolverOf(document, 'brand-a').resolutionOrder.map((e) => e.$ref),
  ).toEqual(['#/modifiers/brand', '#/sets/brand']);
});

test('order reaches a source list through -s', async () => {
  const document = consumer();
  await run(
    'resolver push',
    document,
    { sources: 'sem,dark' },
    { set: 'brand-a/core' },
  );
  await run(
    'resolver order',
    document,
    { target: 'dark@{0}' },
    { set: 'brand-a/core' },
  );
  expect(resolverOf(document, 'brand-a').sets.core?.sources).toEqual([
    { $ref: 'dark.json' },
    { $ref: 'core.json' },
    { $ref: 'sem.json' },
  ]);
});

// ── default / list / round-trip ──────────────────────────────────────────────

test('default retargets and guards', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  await run(
    'resolver add',
    document,
    { operand: 'dark' },
    { modifier: 'theme/dark' },
  );

  const result = await run(
    'resolver default',
    document,
    {},
    { modifier: 'brand-a/theme/dark' },
  );
  expect(result?.summary).toBe('default of brand-a/theme is now dark');
  expect(resolverOf(document, 'brand-a').modifiers.theme?.default).toBe('dark');

  await expect(
    run('resolver default', document, {}, { modifier: 'brand-a/theme/nope' }),
  ).rejects.toThrow(/no context 'nope'/);
  await expect(
    run('resolver default', document, {}, { modifier: 'brand-a/theme' }),
  ).rejects.toThrow(/default addresses a context/);
});

test('list shows every level', async () => {
  const document = consumer();
  await run(
    'resolver add',
    document,
    { operand: 'light' },
    { modifier: 'theme/light' },
  );
  await run(
    'resolver add',
    document,
    { operand: 'dark' },
    { modifier: 'theme/dark' },
  );

  const all = await run('resolver list', document);
  expect(all?.summary).toBe('brand-a — 1 set(s), 1 modifier(s)');

  const one = await run('resolver list', document, { name: 'brand-a' });
  expect(one?.summary).toContain('sets: core');
  expect(one?.summary).toContain('theme (2 context(s), default light)');
  expect(one?.summary).toContain('order: sets/core, modifiers/theme');

  const mod = await run(
    'resolver list',
    document,
    {},
    { modifier: 'brand-a/theme' },
  );
  expect(mod?.summary).toBe(
    'contexts: light (1 source(s)) [default], dark (1 source(s))',
  );

  const sources = await run(
    'resolver list',
    document,
    {},
    { set: 'brand-a/core' },
  );
  expect(sources?.summary).toBe('sources of brand-a/core: core');
});

test('editing preserves pass-through fields — the snapshot is cloned, never mutated', async () => {
  const document = newDocument({
    resolvers: {
      'brand-a': {
        version: '2025.10',
        name: 'authored-name',
        description: 'authored',
        sets: { core: { sources: [{ $ref: 'core.json' }] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/core' }],
        $extensions: { 'vendor.thing': true },
      },
    },
  });
  const before = resolverOf(document, 'brand-a');
  await run('resolver add', document, {}, { set: 'brand-a/sem' });
  const after = resolverOf(document, 'brand-a');
  expect(after.description).toBe('authored');
  expect(after.$extensions).toEqual({ 'vendor.thing': true });
  // The pre-edit snapshot did not gain the set — the verb edited a clone.
  expect(before.sets.sem).toBeUndefined();
});

test('a nested set writes an RFC 6901-escaped order ref and removes cleanly', async () => {
  const document = newDocument({
    sets: ['core', 'brands/brand-b'],
    resolvers: {
      'brand-a': {
        version: '2025.10',
        sets: { core: { sources: [{ $ref: 'core.json' }] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/core' }],
      },
    },
  });
  await run('resolver add', document, {}, { set: 'brand-a/brands/brand-b' });
  let doc = resolverOf(document, 'brand-a');
  expect(doc.sets['brands/brand-b']).toEqual({
    sources: [{ $ref: 'brands/brand-b.json' }],
  });
  expect(doc.resolutionOrder.at(-1)).toEqual({
    $ref: '#/sets/brands~1brand-b',
  });

  const list = await run('resolver list', document, { name: 'brand-a' });
  expect(list?.summary).toContain('sets/brands/brand-b');

  await run('resolver remove', document, {}, { set: 'brand-a/brands/brand-b' });
  doc = resolverOf(document, 'brand-a');
  expect(doc.resolutionOrder).toEqual([{ $ref: '#/sets/core' }]);
});
