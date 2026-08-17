import { expect, test } from 'vitest';
import { createDocument, type Document } from '../document/document';
import type { CommandDescriptor } from '../shell/types';
import { serializeDocument } from '../storage/provider';
import { builtinCommands } from './index';

function newDocument(): Document {
  const document = createDocument();
  document.hydrate(serializeDocument([], ['core'], new Map()));
  return document;
}

function verb(name: string): CommandDescriptor {
  const found = builtinCommands().find((c) => c.name === name);
  if (!found) throw new Error(`no such verb: ${name}`);
  return found;
}

/**
 * Async on purpose: handlers throw synchronously, and an async wrapper turns that into a rejected
 * promise so `.rejects` works uniformly whether a given verb is sync or async. The return type is
 * derived from the contract rather than restated, so it cannot drift from it.
 */
async function run(
  name: string,
  document: Document,
  args: Record<string, string>,
  options: Record<string, unknown> = {},
): Promise<Awaited<ReturnType<CommandDescriptor['run']>>> {
  return verb(name).run({ project: { document }, args, options });
}

async function add(
  document: Document,
  path: string,
  value: string,
  options: Record<string, unknown> = { type: 'color', set: 'core' },
): Promise<void> {
  await run('token add', document, { path, value }, options);
}

test('token add creates a token with its type, value, and set', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000000');

  const [token] = document.getAllTokens();
  expect(token?.path).toEqual(['color', 'base']);
  // Short form in, spec form stored: a colour string transforms into the 2025.10 value object.
  expect(token?.value).toEqual({
    colorSpace: 'oklch',
    components: [0, 0, 0],
    alpha: 1,
    hex: '#000000',
  });
  expect(token?.type).toBe('color');
  expect(token?.set).toBe('core');
});

test('token add parses JSON values but leaves references and hex alone', async () => {
  const document = newDocument();
  await add(document, 'space.1', '{"value":4,"unit":"px"}', {
    type: 'dimension',
    set: 'core',
  });
  await add(document, 'space.2', '8', { type: 'dimension', set: 'core' });
  await add(document, 'space.alias', '{space.1}', {
    type: 'dimension',
    set: 'core',
  });

  const byPath = Object.fromEntries(
    document.getAllTokens().map((t) => [t.path.join('.'), t.value]),
  );
  expect(byPath['space.1']).toEqual({ value: 4, unit: 'px' });
  expect(byPath['space.2']).toBe(8);
  expect(byPath['space.alias']).toBe('{space.1}');
});

test('token add takes its type from the group above, and leaves it inherited', async () => {
  const document = newDocument();
  await run(
    'group add',
    document,
    { path: 'color' },
    { set: 'core', type: 'color' },
  );
  await run(
    'token add',
    document,
    { path: 'color.accent', value: '#fff' },
    { set: 'core' },
  );

  const accent = document
    .getAllTokens()
    .find((t) => t.path.join('.') === 'color.accent');
  expect(accent?.type).toBe('color');

  // The group already declares it, so the token must not carry a copy that could go stale.
  const node = document.getFiles()['core.json']?.color as Record<
    string,
    Record<string, unknown>
  >;
  expect(node?.accent?.$type).toBeUndefined();
});

test('token add does NOT take its type from a sibling', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  // A sibling is a peer, not an authority: one token's type must not silently decide another's.
  await expect(
    run(
      'token add',
      document,
      { path: 'color.accent', value: '#fff' },
      { set: 'core' },
    ),
  ).rejects.toThrow(/needs a --type/);
});

test('a nearer group type wins over a further one', async () => {
  const document = newDocument();
  await run(
    'group add',
    document,
    { path: 'scale' },
    { set: 'core', type: 'dimension' },
  );
  await run(
    'group add',
    document,
    { path: 'scale.weight' },
    { set: 'core', type: 'fontWeight' },
  );
  await run(
    'token add',
    document,
    { path: 'scale.weight.bold', value: '700' },
    { set: 'core' },
  );

  const bold = document
    .getAllTokens()
    .find((t) => t.path.join('.') === 'scale.weight.bold');
  expect(bold?.type).toBe('fontWeight');
});

test('token add refuses an existing path, an unknown set, and a missing type', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await expect(add(document, 'color.base', '#fff')).rejects.toThrow(
    /already exists/,
  );
  await expect(
    add(document, 'other.thing', '#fff', { type: 'color', set: 'nope' }),
  ).rejects.toThrow(/no set 'nope'/);
  await expect(
    run(
      'token add',
      document,
      { path: 'lonely.thing', value: '1' },
      { set: 'core' },
    ),
  ).rejects.toThrow(/needs a --type/);
});

test('token set changes the value and leaves the type', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await run('token set', document, { path: 'color.base', value: '#fff' });

  const [token] = document.getAllTokens();
  expect((token?.value as { hex?: string }).hex).toBe('#ffffff');
  expect(token?.type).toBe('color');
});

test('token set can change the description without touching the value', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await run(
    'token set',
    document,
    { path: 'color.base', value: undefined as unknown as string },
    { description: 'page ink' },
  );

  const [token] = document.getAllTokens();
  expect(token?.description).toBe('page ink');
  expect((token?.value as { hex?: string }).hex).toBe('#000000');
});

test('token set refuses an unknown path and a no-op call', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await expect(
    run('token set', document, { path: 'nope', value: '1' }),
  ).rejects.toThrow(/no token at 'nope'/);
  await expect(
    run('token set', document, {
      path: 'color.base',
      value: undefined as unknown as string,
    }),
  ).rejects.toThrow(/nothing to change/);
});

test('token remove deletes it and refuses an unknown path', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await run('token remove', document, { path: 'color.base' });
  expect(document.getAllTokens()).toHaveLength(0);

  await expect(run('token remove', document, { path: 'nope' })).rejects.toThrow(
    /no token at 'nope'/,
  );
});

test('token remove names a group as a group rather than reporting nothing', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await expect(
    run('token remove', document, { path: 'color' }),
  ).rejects.toThrow(/is a group/);
});

test('token move relocates a token between sets and refuses an unknown one', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');
  await run('set add', document, { name: 'brand' });

  await run('token move', document, { path: 'color.base', set: 'brand' });
  expect(document.getAllTokens()[0]?.set).toBe('brand');

  await expect(
    run('token move', document, { path: 'color.base', set: 'nope' }),
  ).rejects.toThrow(/no set 'nope'/);
  await expect(
    run('token move', document, { path: 'color.base', set: 'brand' }),
  ).rejects.toThrow(/already in 'brand'/);
});

test('token rename rewrites references, and needs --allow-group for a group', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');
  await add(document, 'color.alias', '{color.base}');

  await run('token rename', document, { from: 'color.base', to: 'color.ink' });

  const byPath = Object.fromEntries(
    document.getAllTokens().map((t) => [t.path.join('.'), t.value]),
  );
  expect((byPath['color.ink'] as { hex?: string }).hex).toBe('#000000');
  expect(byPath['color.alias']).toBe('{color.ink}');

  await expect(
    run('token rename', document, { from: 'color', to: 'palette' }),
  ).rejects.toThrow(/--allow-group/);
});

test('set add and set remove manage sets', async () => {
  const document = newDocument();

  await run('set add', document, { name: 'brand' });
  expect(document.getSets()).toContain('brand');

  await expect(run('set add', document, { name: 'brand' })).rejects.toThrow(
    /already exists/,
  );

  await run('set remove', document, { name: 'brand' });
  expect(document.getSets()).not.toContain('brand');
});

test('set remove will not silently discard the tokens it holds', async () => {
  const document = newDocument();
  await add(document, 'color.base', '#000');

  await expect(run('set remove', document, { name: 'core' })).rejects.toThrow(
    /holds 1 token/,
  );

  await run('set remove', document, { name: 'core' }, { force: true });
  expect(document.getSets()).not.toContain('core');
  expect(document.getAllTokens()).toHaveLength(0);
});
