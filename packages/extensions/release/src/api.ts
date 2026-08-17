import type { ActivateContext } from 'vertekum/core';
import { lazyMount } from 'vertekum/lazy-mount';
import { registerRoute } from 'vertekum/ui-contribution';
import { createBridgeFileClient } from './fileClient';
import { createBridgeGitClient } from './gitClient';
import type { releaseManifest } from './index';
import { createReleaseProvider } from './provider-factory';
import { RELEASE_PROVIDER_SERVICE } from './release-service';

/**
 * Headless activation: publishes the active ReleaseProvider as a service (ADR-0023) — the concrete
 * provider (lock-file or git) is a config-selected swap — and owns /release. Route data lives here;
 * the view is behind a thunk (ADR-0029).
 */
export function activate(ctx: ActivateContext<typeof releaseManifest>): void {
  const provider = createReleaseProvider({
    fileClient: createBridgeFileClient(),
    gitClient: createBridgeGitClient(),
    config: () => ctx.config.get(),
  });
  ctx.services.register(RELEASE_PROVIDER_SERVICE, provider);
  registerRoute(ctx, {
    path: '/release',
    ribbon: { label: 'Release', icon: '🏷' },
    mount: lazyMount(() => import('./ui'), ctx),
  });
}
