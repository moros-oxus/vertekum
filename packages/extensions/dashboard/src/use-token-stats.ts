import type { TokenStats, TokenStatsService } from '@vertekum/ext-stats';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to token stats from a (possibly absent) TokenStatsService; undefined when absent.
 * Lives with its sole consumer (the Dashboard) so @vertekum/ext-stats stays a react-free service package.
 */
export function useTokenStats(
  service: TokenStatsService | undefined,
): TokenStats | undefined {
  return useSyncExternalStore(
    useCallback(
      (cb: () => void) => service?.subscribe(cb) ?? (() => {}),
      [service],
    ),
    () => service?.getStats(),
  );
}
