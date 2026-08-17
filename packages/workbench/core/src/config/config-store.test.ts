import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createConfigStore } from './config-store';

const Settings = z.object({
  showIds: z.boolean().default(false),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
});

describe('config store', () => {
  test('get() applies schema defaults when there are no overrides', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    expect(store.get('vtk.tokens')).toEqual({
      showIds: false,
      density: 'comfortable',
    });
  });

  test('host overrides beat schema defaults', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    store.setHostOverrides('vtk.tokens', { density: 'compact' });
    expect(store.get('vtk.tokens')).toEqual({
      showIds: false,
      density: 'compact',
    });
  });

  test('user overrides beat host overrides (user-runtime wins)', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    store.setHostOverrides('vtk.tokens', { density: 'compact' });
    store.setUserOverrides('vtk.tokens', { density: 'comfortable' });
    expect(store.get('vtk.tokens')).toEqual({
      showIds: false,
      density: 'comfortable',
    });
  });

  test('extensions are isolated by id', () => {
    const store = createConfigStore();
    store.registerSchema('a', Settings);
    store.registerSchema('b', z.object({ n: z.number().default(1) }));
    store.setUserOverrides('a', { showIds: true });
    expect(store.get('a')).toEqual({ showIds: true, density: 'comfortable' });
    expect(store.get('b')).toEqual({ n: 1 });
  });

  test('get() returns a stable reference until that slice changes', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    const first = store.get('vtk.tokens');
    expect(store.get('vtk.tokens')).toBe(first); // same ref, no mutation
    store.setUserOverrides('vtk.tokens', { showIds: true });
    expect(store.get('vtk.tokens')).not.toBe(first); // new ref after change
  });

  test('subscribe fires only for the changed id', () => {
    const store = createConfigStore();
    store.registerSchema('a', Settings);
    store.registerSchema('b', Settings);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe('a', a);
    store.subscribe('b', b);
    store.setUserOverrides('a', { showIds: true });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  test('a schema-less extension resolves to an empty object (stable ref)', () => {
    const store = createConfigStore();
    store.registerSchema('bare', undefined);
    const v = store.get('bare');
    expect(v).toEqual({});
    expect(store.get('bare')).toBe(v);
  });

  test('snapshot + hydrate round-trips user overrides', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    store.setUserOverrides('vtk.tokens', { density: 'compact' });
    expect(store.snapshotUserOverrides()).toEqual({
      'vtk.tokens': { density: 'compact' },
    });

    const restored = createConfigStore();
    restored.registerSchema('vtk.tokens', Settings);
    restored.hydrateUserOverrides({ 'vtk.tokens': { density: 'compact' } });
    expect(restored.get('vtk.tokens')).toEqual({
      showIds: false,
      density: 'compact',
    });
  });

  test('registerSchema notifies existing subscribers of that id', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    const listener = vi.fn();
    store.subscribe('vtk.tokens', listener);
    store.registerSchema('vtk.tokens', Settings); // re-register
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('get() falls back to schema defaults when a user override is invalid (never throws)', () => {
    const store = createConfigStore();
    store.registerSchema('vtk.tokens', Settings);
    store.hydrateUserOverrides({
      'vtk.tokens': { density: 'not-a-valid-enum-value' },
    });
    expect(() => store.get('vtk.tokens')).not.toThrow();
    expect(store.get('vtk.tokens')).toEqual({
      showIds: false,
      density: 'comfortable',
    });
  });
});
