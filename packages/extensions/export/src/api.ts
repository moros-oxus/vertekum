import type { ActivateContext } from 'vertekum/core';
import { lazyMount } from 'vertekum/lazy-mount';
import { registerRoute } from 'vertekum/ui-contribution';
import type { exportManifest } from './index';

/**
 * Activation: owns /export. Route data here, view behind a thunk (ADR-0029).
 *
 * This extension is UI only. The exporter registry factory and target validation moved to core
 * (the built-in pass); the CSS exporter is `@vertekum/ext-export-css`, a peer of the terrazzo
 * extension. The route reads the exporter service lazily at render — no format extensions simply
 * means an empty exporter list. Its settings-based target list predates root-config `targets` and
 * shows nothing for root-configured projects; the app host is deferred, so that stands until the
 * host can pass root-config slices to extensions.
 */
export function activate(ctx: ActivateContext<typeof exportManifest>): void {
  registerRoute(ctx, {
    path: '/export',
    ribbon: { label: 'Export', icon: '⤓' },
    mount: lazyMount(() => import('./ui'), ctx),
  });
}
