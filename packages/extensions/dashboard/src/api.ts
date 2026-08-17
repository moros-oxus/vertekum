import type { ExtensionContext } from 'vertekum/core';
import { lazyMount } from 'vertekum/lazy-mount';
import { registerRoute } from 'vertekum/ui-contribution';

/** Headless activation: route path and ribbon are data; the view is a thunk (ADR-0029). */
export function activate(ctx: ExtensionContext): void {
  registerRoute(ctx, {
    path: '/',
    ribbon: { label: 'Dashboard', icon: '⌂' },
    mount: lazyMount(() => import('./ui'), undefined),
  });
}
