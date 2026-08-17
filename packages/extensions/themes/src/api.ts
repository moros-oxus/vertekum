import type { ExtensionContext } from 'vertekum/core';
import { lazyMount } from 'vertekum/lazy-mount';
import { registerRoute } from 'vertekum/ui-contribution';

/**
 * Activation: owns /composition. Route data here, view behind a thunk (ADR-0029).
 *
 * The composition validator moved to core's built-in pass (spec-mandated behaviour): a project
 * without this extension still gets resolver-semantics diagnostics.
 */
export function activate(ctx: ExtensionContext): void {
  registerRoute(ctx, {
    path: '/composition',
    ribbon: { label: 'Composition', icon: '◐' },
    mount: lazyMount(() => import('./ui'), ctx),
  });
}
