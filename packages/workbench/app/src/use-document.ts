import type { Document } from '@vertekum/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to the document's tokens. Relies on getAllTokens() returning a stable reference
 * between mutations, so it's safe across the load→subscribe gap (no local snapshot cache).
 */
export function useTokens(document: Document) {
  return useSyncExternalStore(
    useCallback((cb: () => void) => document.subscribe(cb), [document]),
    () => document.getAllTokens(),
  );
}

/** Subscribe to the document's set list (stable ref between mutations). */
export function useSets(document: Document) {
  return useSyncExternalStore(
    useCallback((cb: () => void) => document.subscribe(cb), [document]),
    () => document.getSets(),
  );
}

/** Subscribe to the document's resolver map (stable ref between mutations). */
export function useResolvers(document: Document) {
  return useSyncExternalStore(
    useCallback((cb: () => void) => document.subscribe(cb), [document]),
    () => document.getResolvers(),
  );
}
