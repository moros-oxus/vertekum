import { expect, test } from 'vitest';
import { createDocument, type Document } from '../document/document';
import type { DtcgNode } from '../dtcg/parse';
import type { CommandDescriptor } from '../shell/types';
import { builtinCommands } from './index';

function newDocument(): Document {
  const document = createDocument();
  document.hydrate({
    'core.json': {
      color: {
        $type: 'color',
        text: { neutral: { $value: '#000' } },
      },
    },
  });
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
  args: Record<string, string>,
  options: Record<string, unknown> = {},
): Promise<unknown> {
  return verb(name).run({ project: { document }, args, options });
}

const core = (document: Document) =>
  document.getFiles()['core.json'] as Record<string, DtcgNode>;

test('group add creates a group and can declare its type', async () => {
  const document = newDocument();
  await run(
    'group add',
    document,
    { path: 'space' },
    { type: 'dimension', description: 'Spacing scale', set: 'core' },
  );

  expect(core(document).space).toEqual({
    $type: 'dimension',
    $description: 'Spacing scale',
  });
});

test('group add refuses a path that already exists', async () => {
  const document = newDocument();
  await expect(
    run('group add', document, { path: 'color.text' }, { set: 'core' }),
  ).rejects.toThrow(/already exists/);
});

test('group set declares a type that descendants inherit', async () => {
  const document = newDocument();
  await run(
    'group set',
    document,
    { path: 'color.text' },
    { type: 'color', set: 'core' },
  );

  expect((core(document).color as DtcgNode).text).toMatchObject({
    $type: 'color',
  });
  expect(
    document
      .getAllTokens()
      .find((t) => t.path.join('.') === 'color.text.neutral')?.type,
  ).toBe('color');
});

test('group set refuses a token, a missing path, and a no-op', async () => {
  const document = newDocument();

  await expect(
    run(
      'group set',
      document,
      { path: 'color.text.neutral' },
      { type: 'color', set: 'core' },
    ),
  ).rejects.toThrow(/is a token, not a group/);
  await expect(
    run(
      'group set',
      document,
      { path: 'nope' },
      { type: 'color', set: 'core' },
    ),
  ).rejects.toThrow(/no group at 'nope'/);
  await expect(
    run('group set', document, { path: 'color.text' }, { set: 'core' }),
  ).rejects.toThrow(/nothing to change/);
});

test('group remove will not silently discard the tokens it holds', async () => {
  const document = newDocument();

  await expect(
    run('group remove', document, { path: 'color.text' }, { set: 'core' }),
  ).rejects.toThrow(/holds 1 token/);

  await run(
    'group remove',
    document,
    { path: 'color.text' },
    { force: true, set: 'core' },
  );
  expect(core(document).color).toEqual({ $type: 'color' });
  expect(document.getAllTokens()).toHaveLength(0);
});

test('group remove clears an empty group — the case no verb could reach before', async () => {
  const document = createDocument();
  document.hydrate({
    'core.json': { color: { $type: 'color', bland: { $type: 'color' } } },
  });

  await run('group remove', document, { path: 'color.bland' }, { set: 'core' });

  // The illegal name is gone; the parent's own declaration is not collateral damage.
  expect(core(document).color).toEqual({ $type: 'color' });
});

test('removing the last member prunes a parent that declared nothing', async () => {
  const document = createDocument();
  document.hydrate({ 'core.json': { color: { bland: { $type: 'color' } } } });

  await run('group remove', document, { path: 'color.bland' }, { set: 'core' });

  // `color` held nothing of its own, so it goes too — removing it is lossless.
  expect(document.getFiles()['core.json']).toEqual({});
});

test('a group edit is undoable like any other command', async () => {
  const document = newDocument();
  const before = document.getFiles();

  await run(
    'group set',
    document,
    { path: 'color.text' },
    { type: 'color', set: 'core' },
  );
  document.undo();

  expect(document.getFiles()).toEqual(before);
});
