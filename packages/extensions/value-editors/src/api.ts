import type { ActivateContext } from 'vertekum/core';
import type { valueEditorsManifest } from './index';
import { createValueEditorRegistry } from './registry';
import { VALUE_EDITOR_SERVICE } from './value-editor';

/**
 * Headless activation: publishes VALUE_EDITOR_SERVICE with LOADERS, not components
 * (ADR-0028, ADR-0029). The editor modules — and their CSS — are evaluated on the first
 * editor render, so this surface loads in plain Node.
 */
export function activate(
  ctx: ActivateContext<typeof valueEditorsManifest>,
): void {
  const registry = createValueEditorRegistry(ctx.config);
  registry.register({
    id: 'vtk.color',
    types: ['color'],
    load: async () => ({
      default: (await import('./ColorEditor')).ColorEditor,
    }),
  });
  registry.register({
    id: 'vtk.dimension',
    types: ['dimension'],
    load: async () => ({
      default: (await import('./DimensionEditor')).DimensionEditor,
    }),
  });
  registry.register({
    id: 'vtk.number',
    types: ['number'],
    load: async () => ({
      default: (await import('./NumberEditor')).NumberEditor,
    }),
  });
  registry.register({
    id: 'vtk.font-weight',
    types: ['fontWeight'],
    load: async () => ({
      default: (await import('./FontWeightEditor')).FontWeightEditor,
    }),
  });
  registry.register({
    id: 'vtk.boolean',
    types: ['boolean'],
    load: async () => ({
      default: (await import('./BooleanEditor')).BooleanEditor,
    }),
  });
  ctx.services.register(VALUE_EDITOR_SERVICE, registry);
}
