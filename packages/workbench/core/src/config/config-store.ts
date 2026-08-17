import type { ZodTypeAny } from 'zod';

/** A read-only, reactive view of one extension's merged config (safe for useSyncExternalStore). */
export interface ScopedConfig<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
}

/**
 * Pure three-tier config engine (no I/O). Per extension id it merges, lowest→highest:
 * schema defaults ⊕ host overrides (tier 2) ⊕ user overrides (tier 3). User wins.
 * `get(id)` returns a stable reference until that slice changes (useSyncExternalStore-safe).
 */
export interface ConfigStore {
  registerSchema(id: string, schema: ZodTypeAny | undefined): void;
  setHostOverrides(id: string, overrides: Record<string, unknown>): void;
  setUserOverrides(id: string, overrides: Record<string, unknown>): void;
  getUserOverrides(id: string): Record<string, unknown>;
  snapshotUserOverrides(): Record<string, Record<string, unknown>>;
  hydrateUserOverrides(all: Record<string, Record<string, unknown>>): void;
  get<T>(id: string): T;
  subscribe(id: string, listener: () => void): () => void;
}

interface Slot {
  schema: ZodTypeAny | undefined;
  host: Record<string, unknown>;
  user: Record<string, unknown>;
  cache: unknown; // stable snapshot; null until (re)computed
  listeners: Set<() => void>;
}

const EMPTY = Object.freeze({});

export function createConfigStore(): ConfigStore {
  const slots = new Map<string, Slot>();

  function slot(id: string): Slot {
    let s = slots.get(id);
    if (!s) {
      s = {
        schema: undefined,
        host: {},
        user: {},
        cache: null,
        listeners: new Set(),
      };
      slots.set(id, s);
    }
    return s;
  }

  function invalidate(s: Slot): void {
    s.cache = null;
    for (const l of s.listeners) l();
  }

  return {
    registerSchema(id, schema) {
      const s = slot(id);
      s.schema = schema;
      invalidate(s);
    },
    setHostOverrides(id, overrides) {
      const s = slot(id);
      s.host = { ...overrides };
      invalidate(s);
    },
    setUserOverrides(id, overrides) {
      const s = slot(id);
      s.user = { ...overrides };
      invalidate(s);
    },
    getUserOverrides(id) {
      return { ...slot(id).user };
    },
    snapshotUserOverrides() {
      const out: Record<string, Record<string, unknown>> = {};
      for (const [id, s] of slots) {
        if (Object.keys(s.user).length > 0) out[id] = { ...s.user };
      }
      return out;
    },
    hydrateUserOverrides(all) {
      for (const [id, overrides] of Object.entries(all)) {
        const s = slot(id);
        s.user = { ...overrides };
        invalidate(s);
      }
    },
    get<T>(id: string): T {
      const s = slot(id);
      if (s.cache === null) {
        if (s.schema) {
          const merged = { ...s.host, ...s.user };
          const result = s.schema.safeParse(merged);
          if (result.success) {
            s.cache = result.data;
          } else {
            const fallback = s.schema.safeParse({});
            s.cache = fallback.success ? fallback.data : EMPTY;
          }
        } else {
          s.cache = EMPTY;
        }
      }
      return s.cache as T;
    },
    subscribe(id, listener) {
      const s = slot(id);
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
      };
    },
  };
}

/** Build a stable, id-scoped view for one extension (created once per extension at activation). */
export function scopedConfig<T>(
  store: ConfigStore,
  id: string,
): ScopedConfig<T> {
  return {
    get: () => store.get<T>(id),
    subscribe: (listener) => store.subscribe(id, listener),
  };
}
