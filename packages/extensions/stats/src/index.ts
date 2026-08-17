import { defineExtension, type ExtensionManifest } from 'vertekum/core';
import { activate } from './api';

// Public surface of the package: the extension plus the service key/types soft-consumers
// (e.g. the Dashboard) depend on.
export type { TokenStats, TokenStatsService } from './token-stats';
export { computeTokenStats, TOKEN_STATS_SERVICE } from './token-stats';

export const statsManifest = {
  id: 'vtk.stats',
  name: 'Token Stats',
  description:
    'Computes live token and group counts and publishes them for other extensions (e.g. the Dashboard). A non-view extension: it contributes no route or ribbon entry.',
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension (trusted): publishes TokenStatsService and contributes
 * no route/ribbon, so it is invisible everywhere except the Extensions surface (ADR-0022).
 */
export const statsExtension = defineExtension<typeof statsManifest>({
  manifest: statsManifest,
  activate,
});
