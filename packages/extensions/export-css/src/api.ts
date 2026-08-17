import {
  type ActivateContext,
  createExporterRegistry,
  EXPORTER_SERVICE,
  type ExporterService,
} from '@vertekum/core';
import { cssExporter } from './css';
import type { cssExportManifest } from './index';

/**
 * Headless activation: contributes one exporter into the shared registry.
 *
 * Get-or-create rather than get-or-warn, so this extension works regardless of where it sits in
 * the consumer's `extensions: [...]` — the same pattern every registry contributor uses
 * (ADR-0023).
 */
export function activate(ctx: ActivateContext<typeof cssExportManifest>): void {
  const existing = ctx.services.get<ExporterService>(EXPORTER_SERVICE);
  const registry = existing ?? createExporterRegistry();
  registry.register(cssExporter);
  if (!existing) ctx.services.register(EXPORTER_SERVICE, registry);
}
