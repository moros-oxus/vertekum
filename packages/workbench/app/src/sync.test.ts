import {
  addToken,
  createDocument,
  type DtcgNode,
  type StorageProvider,
} from '@vertekum/core';
import { describe, expect, test } from 'vitest';
import { createSyncManager } from './sync';

function fakeProvider() {
  let saved: Record<string, DtcgNode> = {};
  const provider: StorageProvider = {
    load: async () => saved,
    save: async (files) => {
      saved = files;
    },
  };
  return { provider, getSaved: () => saved };
}

const token = {
  id: 'tokens:c',
  path: ['c'],
  type: 'color',
  value: '#000',
};

describe('sync manager', () => {
  test('starts clean', () => {
    const sync = createSyncManager(createDocument(), fakeProvider().provider);
    expect(sync.isDirty()).toBe(false);
  });

  test('becomes dirty on a document change', () => {
    const doc = createDocument();
    const sync = createSyncManager(doc, fakeProvider().provider);

    doc.apply(addToken(token));

    expect(sync.isDirty()).toBe(true);
  });

  test('sync writes the document’s files through the provider and clears dirty', async () => {
    const doc = createDocument();
    const { provider, getSaved } = fakeProvider();
    const sync = createSyncManager(doc, provider);
    doc.apply(addToken(token));

    await sync.sync();

    expect(sync.isDirty()).toBe(false);
    expect(getSaved()).toEqual({
      'tokens.json': { c: { $type: 'color', $value: '#000' } },
    });
  });

  test('markSynced clears dirty (e.g. after a load)', () => {
    const doc = createDocument();
    const sync = createSyncManager(doc, fakeProvider().provider);
    doc.apply(addToken(token));

    sync.markSynced();

    expect(sync.isDirty()).toBe(false);
  });
});
