import rawConfig from 'virtual:vertekum-config';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import {
  createKernel,
  createStorageProvider,
  LOCATION_SERVICE,
} from '@vertekum/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
} from './config/defineConfig';
import { createSettingsClient } from './config/settings-client';
import { createExtensionsRoute } from './extensions-surface/extensionsRoute';
import { createLocationService } from './location-service';
import { RouteMount } from './shell/RouteMount';
import { createRouteRegistry } from './shell/route-registry';
import { Shell } from './shell/Shell';
import { createSlotRegistry } from './shell/slot-registry';
import { ROUTE_SERVICE, SLOT_SERVICE } from './shell/ui-contribution';
import { createLocalServerFileStore } from './storage/localServerProvider';
import { createSyncManager } from './sync';
import defaultConfig from './vertekum.config';
import './styles.css';

// The system owns the merge: a consumer's config overrides the app's defaultConfig, so a repo
// config need only carry its changes. Idempotent in standalone dev, where the virtual config
// resolves to defaultConfig itself.
const vertekumConfig = mergeVertekumConfig(
  defaultConfig,
  resolveVertekumConfig(rawConfig, {
    command: 'serve',
    mode: import.meta.env.MODE,
  }),
);

const kernel = createKernel();

// Publish the UI contribution registries BEFORE extensions activate. Core no longer knows what a
// route or a slot is (ADR-0017, ADR-0022) — a UI host provides them, and a headless run does not,
// which is what makes `registerRoute` a no-op there instead of a crash.
const routes = createRouteRegistry();
const slots = createSlotRegistry();
kernel.services.register(ROUTE_SERVICE, routes);
kernel.services.register(SLOT_SERVICE, slots);
// The storage backend is config-selected (the "substrate adapter"), defaulting to the local bridge.
const provider = (
  vertekumConfig.storage ??
  (() => createStorageProvider(createLocalServerFileStore()))
)();
const sync = createSyncManager(kernel.document, provider);

// Flatten the extensions array (bundles, inline `ext({…})` config, uncalled) into the kernel's
// id-keyed shape, then register the HostExtensions, apply the inline options as tier-2 setting
// overrides, and activate (ADR-0009, ADR-0022). Inline options are tier-2 — tier-3 user overrides
// still win and the Settings UI still edits them live.
const { extensions, settings } = normalizeExtensions(
  vertekumConfig.extensions ?? [],
  vertekumConfig.settings,
);
for (const extension of extensions) kernel.register(extension);
for (const [id, overrides] of Object.entries(settings)) {
  kernel.config.setHostOverrides(id, overrides);
}
kernel.start();

// Load tier-3 user overrides from the bridge server and hydrate the config store reactively;
// views subscribed via useConfig re-render once overrides arrive (ADR-0015).
const settingsClient = createSettingsClient();
settingsClient
  .load()
  .then((overrides) => kernel.config.hydrateUserOverrides(overrides))
  .catch((error) => console.error('failed to load settings', error));

const persistSettings = () => {
  void settingsClient.save(kernel.config.snapshotUserOverrides());
};

// Register the privileged, cross-extension /extensions route (the Extensions & Settings area)
// after start(), so getExtensions() returns fully-activated extensions with their recorded
// contributions, before the route tree is built below (ADR-0027).
routes.register(
  createExtensionsRoute({
    extensions: kernel.getExtensions(),
    config: kernel.config,
    persist: persistSettings,
  }),
);

// Load the collection from the bridge server, hydrate the working copy, and mark it as the
// synced baseline so it starts clean (ADR-0003/0016, ADR-0019).
provider
  .load()
  .then((files) => {
    kernel.document.hydrate(files);
    sync.markSynced();
  })
  .catch((error) => console.error('failed to load collection', error));

// Build the TanStack Router route tree from the kernel's registered routes. The router is
// an app-shell detail; route plugins never see it (ADR-0017, ADR-0022).
const rootRoute = createRootRoute({
  component: () => (
    <Shell kernel={kernel} routes={routes} slots={slots} sync={sync} />
  ),
});
const routeTree = rootRoute.addChildren(
  routes.getRoutes().map((route) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: route.path,
      component: () => <RouteMount route={route} context={kernel.context} />,
    }),
  ),
);
const router = createRouter({ routeTree });

// Publish URL access on the context so router-isolated routes can persist view state
// (e.g. the selected theme) in the querystring (ADR-0017, ADR-0022).
kernel.services.register(LOCATION_SERVICE, createLocationService(router));

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
