import type { Token } from 'vertekum';

/** Well-known service key under which the Stats extension publishes token counts (ADR-0022). */
export const TOKEN_STATS_SERVICE = 'tokenStats';

/** Aggregate counts over the document's tokens. */
export interface TokenStats {
  tokens: number;
  groups: number;
}

/**
 * The contract the Dashboard soft-consumes (published by the Stats extension). Consumers
 * degrade to no stats when it is absent, so the Dashboard never depends on Stats (ADR-0023).
 * Lives with the extension in @vertekum/ext-stats, not the kernel — token-stats is a feature, not a
 * core concept (ADR-0009). Neither the Dashboard nor the extension imports the other; both
 * depend only on this side-effect-free contract module.
 */
export interface TokenStatsService {
  getStats(): TokenStats;
  subscribe(listener: () => void): () => void;
}

/**
 * Pure count over tokens: total tokens, and distinct parent groups (the path minus its final
 * segment, joined with '.', matching group-tokens.ts).
 */
export function computeTokenStats(tokens: Token[]): TokenStats {
  const groups = new Set<string>();
  for (const token of tokens) {
    groups.add(token.path.slice(0, -1).join('.'));
  }
  return { tokens: tokens.length, groups: groups.size };
}
