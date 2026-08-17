import type { ActivateContext } from 'vertekum/core';
import { lazyMount } from 'vertekum/lazy-mount';
import { registerRoute } from 'vertekum/ui-contribution';
import type { tokensManifest } from './index';

/**
 * Activation: owns /tokens. Route data here, view behind a thunk (ADR-0029).
 *
 * `token rename` used to be registered here — it moved to core as a curation primitive. The
 * token-reference validator followed for the same reason (spec-mandated behaviour, §7.2.3/§7.4.5):
 * it runs from core's built-in pass, so a project without this extension still gets it.
 */
export function activate(ctx: ActivateContext<typeof tokensManifest>): void {
  registerRoute(ctx, {
    path: '/tokens',
    ribbon: { label: 'Tokens', icon: '❖' },
    mount: lazyMount(() => import('./ui'), ctx),
  });
}
