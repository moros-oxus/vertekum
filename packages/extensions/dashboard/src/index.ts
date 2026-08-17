import { defineExtension } from 'vertekum/core';
import { activate } from './api';

/** First-party Dashboard route HostExtension (trusted). Never imports the router. */
export const dashboardExtension = defineExtension({
  manifest: { id: 'vtk.dashboard', name: 'Dashboard' },
  activate,
});
