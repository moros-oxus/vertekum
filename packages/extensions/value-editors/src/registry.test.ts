import { expect, test, vi } from 'vitest';
import { createValueEditorRegistry } from './registry';
import type { ValueEditor, ValueEditorLoader } from './value-editor';

// Dummy editor loaders: registrations hold loaders, not components (ADR-0029).
const A: ValueEditorLoader = async () => ({
  default: (() => null) as unknown as ValueEditor,
});
const B: ValueEditorLoader = async () => ({
  default: (() => null) as unknown as ValueEditor,
});

/** A minimal mutable ScopedConfig<{preferred}> whose changes can be triggered by hand. */
function mockConfig(initial: Record<string, string> = {}) {
  let preferred = initial;
  const listeners = new Set<() => void>();
  return {
    config: {
      get: () => ({ preferred }),
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
    setPreferred(next: Record<string, string>) {
      preferred = next;
      for (const l of listeners) l();
    },
  };
}

test('resolve returns the first-registered editor for a type', () => {
  const { config } = mockConfig();
  const r = createValueEditorRegistry(config);
  r.register({ id: 'a', types: ['color'], load: A });
  r.register({ id: 'b', types: ['color'], load: B });
  expect(r.resolve('color')).toBe(A);
});

test('a config preference overrides the default', () => {
  const { config } = mockConfig({ color: 'b' });
  const r = createValueEditorRegistry(config);
  r.register({ id: 'a', types: ['color'], load: A });
  r.register({ id: 'b', types: ['color'], load: B });
  expect(r.resolve('color')).toBe(B);
});

test('a preference naming an editor that does not serve the type is ignored', () => {
  const { config } = mockConfig({ color: 'num' });
  const r = createValueEditorRegistry(config);
  r.register({ id: 'a', types: ['color'], load: A });
  r.register({ id: 'num', types: ['number'], load: B });
  expect(r.resolve('color')).toBe(A);
});

test('resolve returns undefined for an unserved type', () => {
  const { config } = mockConfig();
  const r = createValueEditorRegistry(config);
  r.register({ id: 'a', types: ['color'], load: A });
  expect(r.resolve('dimension')).toBeUndefined();
});

test('subscribers fire when the preference changes', () => {
  const { config, setPreferred } = mockConfig();
  const r = createValueEditorRegistry(config);
  const listener = vi.fn();
  r.subscribe(listener);
  setPreferred({ color: 'b' });
  expect(listener).toHaveBeenCalledTimes(1);
});
