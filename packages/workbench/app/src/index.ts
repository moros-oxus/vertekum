// `vertekum` — the umbrella. The single import surface for building against Vertekum: the kernel
// (defineExtension, types, document, services, storage, versioning) re-exported from @vertekum/core,
// plus the react authoring layer (reactMount + hooks) and the host-config API. Extensions build
// against `vertekum` + `react`; they import UI from `@vertekum-ui/react` and other extensions from
// `@vertekum/ext-*`. This package is also the runtime SPA (served by Vite) and owns the `vertekum` bin.

// The kernel + authoring API (defineExtension, Extension/context types, Token, commands, services,
// StorageProvider, versioning, …).
export * from '@vertekum/core';
// Host-config API.
export type {
  ExtensionEntry,
  VertekumConfig,
  VertekumConfigEnv,
  VertekumConfigInput,
} from './config/defineConfig';
export {
  defineConfig,
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
} from './config/defineConfig';
export type { LazyView } from './lazy-mount';
export { lazyMount } from './lazy-mount';
export { reactMount } from './react-mount';
export { createRouteRegistry } from './shell/route-registry';
export { createSlotRegistry } from './shell/slot-registry';
// The react authoring layer (folded-in kit): route mount + document hooks.
// The UI contribution surface — routes, slots, and mounting. These live here rather than in core:
// they are the app's framework, and a headless run has no use for them (ADR-0017, ADR-0022).
export type {
  MountFn,
  RibbonEntry,
  RibbonLink,
  Route,
  RouteContribution,
  RouteRegistry,
  SlotContribution,
  SlotRegistry,
} from './shell/ui-contribution';
export {
  contributeSlot,
  ROUTE_SERVICE,
  registerRoute,
  SLOT_SERVICE,
} from './shell/ui-contribution';
export { createLocalServerFileStore } from './storage/localServerProvider';
export { useResolvers, useSets, useTokens } from './use-document';
export { useConfig } from './useConfig';
// NOTE: `defaultConfig` is intentionally NOT re-exported here. It lives at the `vertekum/default-config`
// subpath instead. The default config imports the `@vertekum/ext-essentials` barrel, and every extension
// imports `vertekum` (this umbrella) for the authoring API — re-exporting it here would form a cycle
// (umbrella → default-config → essentials barrel → extensions → umbrella) that TDZ-crashes on the
// barrel's `essentials` const depending on module-eval order. Consumers import it from the subpath.
