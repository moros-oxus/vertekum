import { expect, test } from 'vitest';
import { z } from 'zod';
import { defineExtension } from '../shell/define-extension';
import type { Extension } from '../shell/types';
import type { StorageProvider } from '../storage/provider';
import type { VertekumConfig } from './define-config';
import {
  defineConfig,
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
} from './define-config';

// Minimal Extension stubs — merge only cares about identity, not shape.
const extA = { manifest: { id: 'a' } } as unknown as Extension;
const extB = { manifest: { id: 'b' } } as unknown as Extension;
const base: VertekumConfig = {
  extensions: [extA],
  settings: { 'vtk.stats': { foo: true } },
};

test('defineConfig passes a collection dir through', () => {
  const config = defineConfig({ extensions: [], collection: './tokens' });
  expect(config.collection).toBe('./tokens');
});

test('collection is optional', () => {
  const config: VertekumConfig = defineConfig({ extensions: [] });
  expect(config.collection).toBeUndefined();
});

test('resolveVertekumConfig returns an object config unchanged', () => {
  const cfg = { extensions: [] };
  const env = { command: 'serve', mode: 'development' } as const;
  expect(resolveVertekumConfig(cfg, env)).toBe(cfg);
});

test('resolveVertekumConfig invokes a function config with the env', () => {
  const seen: unknown[] = [];
  const result = resolveVertekumConfig(
    (env) => {
      seen.push(env);
      return { extensions: [], collection: env.mode };
    },
    { command: 'serve', mode: 'prod' },
  );
  expect(seen).toEqual([{ command: 'serve', mode: 'prod' }]);
  expect(result.collection).toBe('prod');
});

test('extensions is optional', () => {
  const config: VertekumConfig = defineConfig({ collection: './tokens' });
  expect(config.extensions).toBeUndefined();
});

test('mergeVertekumConfig: a bare override inherits the base extensions', () => {
  const merged = mergeVertekumConfig(base, { collection: './tokens' });
  expect(merged.extensions).toEqual([extA]);
  expect(merged.collection).toBe('./tokens');
});

test('mergeVertekumConfig: override extensions win', () => {
  const merged = mergeVertekumConfig(base, { extensions: [extB] });
  expect(merged.extensions).toEqual([extB]);
});

test('mergeVertekumConfig: settings deep-merge per extension id', () => {
  const merged = mergeVertekumConfig(base, {
    settings: {
      'vtk.stats': { extra: 1 },
      'vtk.release': { changelogPath: 'X' },
    },
  });
  expect(merged.settings).toEqual({
    'vtk.stats': { foo: true, extra: 1 },
    'vtk.release': { changelogPath: 'X' },
  });
});

test('mergeVertekumConfig: idempotent on (base, base)', () => {
  expect(mergeVertekumConfig(base, base)).toEqual(base);
});

test('mergeVertekumConfig: storage override wins, else inherits base', () => {
  const baseStore = () => ({}) as StorageProvider;
  const overrideStore = () => ({}) as StorageProvider;
  const withBase: VertekumConfig = { extensions: [extA], storage: baseStore };
  // override supplies its own storage → wins
  expect(
    mergeVertekumConfig(withBase, { storage: overrideStore }).storage,
  ).toBe(overrideStore);
  // override omits storage → inherits base's
  expect(mergeVertekumConfig(withBase, { collection: './t' }).storage).toBe(
    baseStore,
  );
});

// --- normalizeExtensions -------------------------------------------------

const demo = defineExtension<{
  id: 'vtk.demo';
  name: 'Demo';
  settings: z.ZodObject<{ flag: z.ZodDefault<z.ZodBoolean> }>;
}>({
  manifest: {
    id: 'vtk.demo',
    name: 'Demo',
    settings: z.object({ flag: z.boolean().default(false) }),
  },
  activate() {},
});
const plain = {
  manifest: { id: 'plain' },
  activate() {},
} as unknown as Extension;

test('normalizeExtensions: plain extension → no overrides', () => {
  const { extensions, settings } = normalizeExtensions([plain]);
  expect(extensions).toEqual([plain]);
  expect(settings).toEqual({});
});

test('normalizeExtensions: configured extension → tier-2 override', () => {
  const { extensions, settings } = normalizeExtensions([demo({ flag: true })]);
  expect(extensions.map((e) => e.manifest.id)).toEqual(['vtk.demo']);
  expect(settings).toEqual({ 'vtk.demo': { flag: true } });
});

test('normalizeExtensions: uncalled callable → empty overrides', () => {
  const { extensions, settings } = normalizeExtensions([demo]);
  expect(extensions.map((e) => e.manifest.id)).toEqual(['vtk.demo']);
  expect(settings).toEqual({});
});

test('normalizeExtensions: nested bundle array is flattened in order', () => {
  const { extensions } = normalizeExtensions([plain, [demo({ flag: true })]]);
  expect(extensions.map((e) => e.manifest.id)).toEqual(['plain', 'vtk.demo']);
});

test('normalizeExtensions: duplicate id is last-wins (replace, no merge)', () => {
  const { settings } = normalizeExtensions([
    demo({ flag: false }),
    demo({ flag: true }),
  ]);
  expect(settings).toEqual({ 'vtk.demo': { flag: true } });
});

test('normalizeExtensions: top-level settings map wins over inline', () => {
  const { settings } = normalizeExtensions([demo({ flag: true })], {
    'vtk.demo': { flag: false },
  });
  expect(settings).toEqual({ 'vtk.demo': { flag: false } });
});
