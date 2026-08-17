import type { ServiceRegistry } from './types';

/**
 * A key→service map extensions publish into and consume from, decoupled: a consumer looks
 * a service up by key and degrades gracefully if it's absent (ADR-0022). The contract for a
 * given key is defined in `@vertekum/core` so publisher and consumer never import each other.
 */
export function createServiceRegistry(): ServiceRegistry {
  const services = new Map<string, unknown>();

  return {
    register(key, service) {
      services.set(key, service);
    },
    get<T>(key: string): T | undefined {
      return services.get(key) as T | undefined;
    },
  };
}
