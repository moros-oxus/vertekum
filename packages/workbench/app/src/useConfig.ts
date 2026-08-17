import type { ScopedConfig } from '@vertekum/core';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe a view to its extension's merged config. Relies on ScopedConfig.get() returning a
 * stable reference between changes (same rule as useTokens), so it's race-safe. Config is a
 * VIEW concern — read it here, not in activate() (design spec 2026-07-03).
 */
export function useConfig<T>(config: ScopedConfig<T>): T {
  return useSyncExternalStore(
    useCallback((cb: () => void) => config.subscribe(cb), [config]),
    () => config.get(),
  );
}
