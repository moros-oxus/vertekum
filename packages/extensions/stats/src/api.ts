import type { ExtensionContext } from 'vertekum/core';
import { createTokenStatsService } from './stats-service';
import { TOKEN_STATS_SERVICE } from './token-stats';

/** Headless activation: publishes TokenStatsService. Non-view — no route, no ribbon. */
export function activate(ctx: ExtensionContext): void {
  ctx.services.register(
    TOKEN_STATS_SERVICE,
    createTokenStatsService(ctx.document),
  );
}
