/** Well-known service key under which the app shell publishes URL/location access. */
export const LOCATION_SERVICE = 'location';

/**
 * Read/write URL search params + subscribe to changes (ADR-0022). Published by the shell,
 * which owns the router; route content is router-isolated (ADR-0017) so it reaches the URL
 * through this contract rather than importing the router.
 */
export interface LocationService {
  getParam(key: string): string | undefined;
  /** Set a search param, or remove it when `value` is undefined. */
  setParam(key: string, value: string | undefined): void;
  subscribe(listener: () => void): () => void;
}
