import type { ScopedConfig } from 'vertekum';
import type {
  ValueEditorRegistration,
  ValueEditorService,
} from './value-editor';

interface Selection {
  preferred: Record<string, string>;
}

/**
 * Build the value-editor registry over an extension's scoped config. `resolve(type)` applies
 * `preferred[type]` (when that editor serves the type) then falls back to the first-registered
 * editor for the type. Forwards config changes to its own subscribers so consumers re-resolve.
 */
export function createValueEditorRegistry(
  config: ScopedConfig<Selection>,
): ValueEditorService {
  const byId = new Map<string, ValueEditorRegistration>();
  const listeners = new Set<() => void>();
  config.subscribe(() => {
    for (const l of listeners) l();
  });

  return {
    register(reg) {
      byId.set(reg.id, reg);
    },
    resolve(type) {
      const prefId = config.get().preferred[type];
      if (prefId) {
        const pref = byId.get(prefId);
        if (pref?.types.includes(type)) return pref.load;
      }
      for (const reg of byId.values()) {
        if (reg.types.includes(type)) return reg.load;
      }
      return undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return config.get();
    },
  };
}
