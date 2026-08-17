import type { ComponentType } from 'react';

/** Service-registry key under which the value-editor registry is published (ADR-0028). */
export const VALUE_EDITOR_SERVICE = 'valueEditor';

/** The dumb, placement-agnostic contract every value editor implements. */
export interface ValueEditorProps {
  value: unknown;
  onCommit: (next: unknown) => void;
}

export type ValueEditor = ComponentType<ValueEditorProps>;

/**
 * A deferred editor module: `default` is the component. Registrations hold loaders rather than
 * components so the extension's `api` surface stays React-free and a headless boot never evaluates
 * an editor module or its CSS (ADR-0029). `ValueField` wraps the loader with `React.lazy`.
 */
export type ValueEditorLoader = () => Promise<{ default: ValueEditor }>;

/** One editor's registration: a stable id, the $types it serves, and a loader for the component. */
export interface ValueEditorRegistration {
  id: string;
  types: string[];
  load: ValueEditorLoader;
}

/**
 * An id-keyed registry of value editors, published as a single service so a plugin can
 * `get` it and contribute editors. `resolve(type)` applies the user's per-type preference
 * then falls back to the first-registered editor for the type (ADR-0028).
 */
export interface ValueEditorService {
  register(reg: ValueEditorRegistration): void;
  resolve(type: string): ValueEditorLoader | undefined;
  subscribe(listener: () => void): () => void;
  /** Opaque snapshot that changes when selection could change; for useSyncExternalStore. */
  getSnapshot(): unknown;
}
