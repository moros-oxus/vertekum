import { describe, expect, test } from 'vitest';
import { createDocument } from '../document/document';
import type { DtcgNode } from '../dtcg/parse';
import { createStorageProvider, type FileStore } from './provider';

function memoryStore(initial: Record<string, DtcgNode> = {}): FileStore {
  let files: Record<string, DtcgNode> = { ...initial };
  return {
    readAll: async () => files,
    writeAll: async (next) => {
      files = next;
    },
  };
}

/**
 * The provider carries files in both directions and translates nothing — the document holds parsed
 * files, so there is nothing left to convert. Partitioning sets from resolvers moved to the
 * document, which is where the distinction is actually used.
 */
describe('storage provider', () => {
  test('load returns the store’s files untouched', async () => {
    const files = {
      'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'empty.json': {},
      'acme.resolver.json': { version: '2025.10' },
    };
    const provider = createStorageProvider(memoryStore(files));
    expect(await provider.load()).toEqual(files);
  });

  test('save writes the record it is given, and round-trips', async () => {
    const store = memoryStore();
    const provider = createStorageProvider(store);
    const files = {
      'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'empty.json': {},
    };

    await provider.save(files);
    expect(await store.readAll()).toEqual(files);
    expect(await provider.load()).toEqual(files);
  });

  test('a file dropped from the record is absent from the write (dir-sync)', async () => {
    const store = memoryStore({
      'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'brand.json': { color: { b: { $type: 'color', $value: '#0f0' } } },
    });
    const provider = createStorageProvider(store);

    const files = await provider.load();
    delete files['brand.json'];
    await provider.save(files);

    expect(Object.keys(await store.readAll())).toEqual(['core.json']);
  });

  test('a document hydrated from a provider partitions sets from resolvers', async () => {
    const provider = createStorageProvider(
      memoryStore({
        'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
        'acme.resolver.json': {
          version: '2025.10',
          sets: { core: { sources: [{ $ref: 'core.json' }] } },
          modifiers: {},
          resolutionOrder: [{ $ref: '#/sets/core' }],
        },
      }),
    );

    const document = createDocument();
    document.hydrate(await provider.load());

    expect(document.getSets()).toEqual(['core']); // NOT 'acme.resolver'
    expect(document.getAllTokens().map((t) => t.path.join('.'))).toEqual([
      'color.a',
    ]);
    expect([...document.getResolvers().keys()]).toEqual(['acme']);
    expect(document.getResolvers().get('acme')?.version).toBe('2025.10');
  });

  test('a document round-trips through the provider unchanged', async () => {
    const files = {
      'core.json': {
        color: { $type: 'color', a: { $value: '#f00' } },
      },
      'acme.resolver.json': {
        version: '2025.10',
        sets: {},
        modifiers: {},
        resolutionOrder: [],
      },
    };
    const store = memoryStore(files);
    const provider = createStorageProvider(store);

    const document = createDocument();
    document.hydrate(await provider.load());
    await provider.save(document.getFiles());

    expect(await store.readAll()).toEqual(files);
  });
});
