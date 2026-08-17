import type { Exporter, ExporterService } from './exporter';

/** An id-keyed exporter registry; exporter extensions get-or-create it (ADR-0023). `list()` returns a stable snapshot per generation. */
export function createExporterRegistry(): ExporterService {
  const byId = new Map<string, Exporter>();
  const listeners = new Set<() => void>();
  let snapshot: Exporter[] | null = null;
  return {
    register(exporter) {
      byId.set(exporter.id, exporter);
      snapshot = null;
      for (const l of listeners) l();
    },
    get(id) {
      return byId.get(id);
    },
    list() {
      if (snapshot === null) snapshot = [...byId.values()];
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
