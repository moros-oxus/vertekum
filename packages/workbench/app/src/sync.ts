import type { Document, StorageProvider } from '@vertekum/core';

/**
 * Tracks whether the working copy has unsaved changes and writes it through to the files
 * (ADR-0019, skeleton form: plain write-through, no git). Dirty = the document has mutated
 * since the last sync/load, detected via the document version.
 */
export interface SyncManager {
  isDirty(): boolean;
  sync(): Promise<void>;
  /** Mark the current state as the synced baseline (e.g. right after loading). */
  markSynced(): void;
  subscribe(listener: () => void): () => void;
}

export function createSyncManager(
  document: Document,
  provider: StorageProvider,
): SyncManager {
  let lastSynced = document.getVersion();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  // Dirty state can change on any document mutation.
  document.subscribe(emit);

  return {
    isDirty() {
      return document.getVersion() !== lastSynced;
    },
    async sync() {
      const versionSaved = document.getVersion();
      await provider.save(document.getFiles());
      lastSynced = versionSaved; // edits made during the save stay dirty
      emit();
    },
    markSynced() {
      lastSynced = document.getVersion();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
