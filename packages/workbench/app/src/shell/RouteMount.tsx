import type { ExtensionContext } from '@vertekum/core';
import { useEffect, useRef } from 'react';
import type { Route } from './ui-contribution';

/**
 * Mounts a registered route's framework-agnostic mount() into the router outlet
 * (ADR-0017, ADR-0022). The route's content runs in its own root, isolated from the
 * shell's router context.
 */
export function RouteMount({
  route,
  context,
}: {
  route: Route;
  context: ExtensionContext;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const cleanup = route.mount(host, context);
    return () => {
      // A mount that returns a cleanup owns its DOM teardown (e.g. reactMount unmounts
      // its own root, deferred). Only clear the host for raw mounts with no cleanup.
      if (cleanup) cleanup();
      else host.replaceChildren();
    };
  }, [route, context]);

  return <div className="vtk-route" ref={ref} />;
}
