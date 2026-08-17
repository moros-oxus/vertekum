import type { AnyRouter } from '@tanstack/react-router';
import type { LocationService } from '@vertekum/core';

/**
 * LocationService backed by TanStack Router (ADR-0022). Lives in the shell (which owns the
 * router) and is published on the context so router-isolated route content can read/write
 * URL search params without importing the router (ADR-0017).
 */
export function createLocationService(router: AnyRouter): LocationService {
  return {
    getParam(key) {
      const search = router.state.location.search as Record<string, unknown>;
      const value = search[key];
      return typeof value === 'string' ? value : undefined;
    },
    setParam(key, value) {
      void router.navigate({
        to: router.state.location.pathname,
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          if (value === undefined) delete next[key];
          else next[key] = value;
          return next;
        },
        replace: true,
      });
    },
    subscribe(listener) {
      return router.subscribe('onResolved', () => listener());
    },
  };
}
