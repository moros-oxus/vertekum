import type { ExtensionContext } from '@vertekum/core';

/**
 * The UI contribution surface. These types used to live in `@vertekum/core`, which meant the
 * system carried the app's framework: `MountFn`, routes, slots, and ribbon icons mean nothing to a
 * CLI run, and their presence in core was why severing the app looked hard.
 *
 * They are published as SERVICES rather than kernel fields (ADR-0023). A UI host registers them
 * before extensions activate; a headless run simply does not, and `registerRoute` becomes a no-op
 * instead of a crash. That makes "this extension wants a UI host" an explicit, degradable fact.
 */

/**
 * Framework-agnostic UI boundary (ADR-0017): a contribution mounts into a DOM element and returns
 * an optional cleanup function. First-party UI uses React internally but exposes only this contract.
 */
export type MountFn = (
  element: HTMLElement,
  context: ExtensionContext,
  // biome-ignore lint/suspicious/noConfusingVoidType: optional cleanup return, same shape as React's EffectCallback
) => (() => void) | void;

export interface SlotContribution {
  id: string;
  mount: MountFn;
}

/** Named-region registry for the app shell (ADR-0016). */
export interface SlotRegistry {
  defineSlot(slotId: string): void;
  hasSlot(slotId: string): boolean;
  contribute(slotId: string, contribution: SlotContribution): void;
  getContributions(slotId: string): SlotContribution[];
}

/** A nav entry a route contributes to the ribbon (ADR-0022). */
export interface RibbonEntry {
  label: string;
  icon?: string;
}

/** A route contributed by a HostExtension; mounts into the `main` outlet (ADR-0022). */
export interface Route {
  path: string;
  mount: MountFn;
  ribbon?: RibbonEntry;
}

export interface RibbonLink {
  path: string;
  label: string;
  icon?: string;
}

/** Registry of routes; TanStack Router drives it in the app shell (ADR-0022). */
export interface RouteRegistry {
  register(route: Route): void;
  getRoutes(): Route[];
  getRibbonEntries(): RibbonLink[];
}

/** Service keys a UI host publishes so extensions can find the registries. */
export const ROUTE_SERVICE = 'ui.routes';
export const SLOT_SERVICE = 'ui.slots';

/** What `contribute()` records for a route — provenance only, no mount function. */
export interface RouteContribution {
  path: string;
  ribbon?: RibbonEntry;
}

/**
 * Register a route with whatever UI host is present, and record it for provenance.
 *
 * No host means no route, silently — a headless `build` or `check` has nowhere to mount and does
 * not want one. The `contribute` call still happens, so `describe` can report what an extension
 * *would* contribute even when nothing is there to receive it.
 */
export function registerRoute(ctx: ExtensionContext, route: Route): void {
  ctx.contribute('routes', {
    path: route.path,
    ...(route.ribbon ? { ribbon: route.ribbon } : {}),
  } satisfies RouteContribution);
  ctx.services.get<RouteRegistry>(ROUTE_SERVICE)?.register(route);
}

/** Contribute to a named slot, recording it for provenance. Degrades like `registerRoute`. */
export function contributeSlot(
  ctx: ExtensionContext,
  slotId: string,
  contribution: SlotContribution,
): void {
  ctx.contribute('slots', slotId);
  ctx.services
    .get<SlotRegistry>(SLOT_SERVICE)
    ?.contribute(slotId, contribution);
}
