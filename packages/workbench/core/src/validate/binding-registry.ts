import type { SchemaBinding } from './schema';

/**
 * Extension-contributed schema bindings — the automated path for an installed extension to
 * validate files without a manual `schemas: […]` config entry. Bindings LAYER exactly like
 * configured ones (`validateFiles` takes them all); nothing here touches the `dtcg-tokens`
 * binding — an extension validating its own `$extensions` payload adds a binding, it never
 * replaces the spec's.
 */
export interface SchemaBindingService {
  register(binding: SchemaBinding): void;
  list(): SchemaBinding[];
}

/** The well-known service key extensions reach the registry under (`ctx.services.get(...)`). */
export const SCHEMA_BINDING_SERVICE = 'schema-bindings';

/** The kernel pre-creates this so `check` can consult it whether or not any extension registered. */
export function createSchemaBindingRegistry(): SchemaBindingService {
  const bindings: SchemaBinding[] = [];
  let snapshot: SchemaBinding[] | null = null;
  return {
    register(binding) {
      bindings.push({ origin: 'extension', ...binding });
      snapshot = null;
    },
    list() {
      if (snapshot === null) snapshot = [...bindings];
      return snapshot;
    },
  };
}
