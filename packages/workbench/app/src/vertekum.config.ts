import { createStorageProvider } from '@vertekum/core';
import { essentials } from '@vertekum/ext-essentials';
import { defineConfig } from './config/defineConfig';
import { createLocalServerFileStore } from './storage/localServerProvider';

/**
 * In-repo host config. Discovering/loading this from an arbitrary consumer project is a
 * deferred seam (design spec 2026-07-03) — for now it is imported directly by main.tsx.
 */
export default defineConfig({
  // The bundled default extension set (@vertekum/ext-essentials). A consumer config overrides this.
  extensions: essentials,
  // The bundled default storage backend: the local bridge. Override in a repo config for a
  // different backend (git/hosted later).
  storage: () => createStorageProvider(createLocalServerFileStore()),
});
