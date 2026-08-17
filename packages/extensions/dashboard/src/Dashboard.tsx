import {
  TOKEN_STATS_SERVICE,
  type TokenStatsService,
} from '@vertekum/ext-stats';
import type { ExtensionContext } from 'vertekum';
import { useTokenStats } from './use-token-stats';
import './Dashboard.css';

/**
 * The Dashboard route. Soft-consumes TokenStatsService (published by the non-view vtk.stats
 * extension) and shows live counts; degrades to a blank state when the service is absent
 * (ADR-0023).
 */
export function Dashboard({ context }: { context: ExtensionContext }) {
  const stats = useTokenStats(
    context.services.get<TokenStatsService>(TOKEN_STATS_SERVICE),
  );
  return (
    <div className="vtk-dashboard">
      <h1>Dashboard</h1>
      {stats ? (
        <dl className="vtk-dashboard-stats">
          <div>
            <dt>Tokens</dt>
            <dd>{stats.tokens}</dd>
          </div>
          <div>
            <dt>Groups</dt>
            <dd>{stats.groups}</dd>
          </div>
        </dl>
      ) : (
        <p>Nothing here yet.</p>
      )}
    </div>
  );
}
