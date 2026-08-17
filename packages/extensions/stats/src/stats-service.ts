import type { Document } from 'vertekum';
import {
  computeTokenStats,
  type TokenStats,
  type TokenStatsService,
} from './token-stats';

/**
 * Publishes live token counts. Recomputes on every document change, caching a stable snapshot
 * between changes so useSyncExternalStore consumers don't tear (same rule as the config store).
 */
export function createTokenStatsService(document: Document): TokenStatsService {
  const listeners = new Set<() => void>();
  let cache: TokenStats | null = null;

  const invalidate = () => {
    cache = null;
    for (const listener of listeners) listener();
  };
  document.subscribe(invalidate);

  return {
    getStats() {
      if (cache === null) {
        cache = computeTokenStats(document.getAllTokens());
      }
      return cache;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
