import { defineExtension } from 'vertekum/core';
import { activate } from './api';

/**
 * First-party Composition route (front-facing "composition"; a composition = a DTCG resolver
 * document). Owns /composition. The internal id stays `vtk.themes` (packaging unchanged). It no
 * longer publishes a service — RESOLVER_SERVICE is R3.
 */
export const themesExtension = defineExtension({
  manifest: { id: 'vtk.themes', name: 'Composition' },
  activate,
});
