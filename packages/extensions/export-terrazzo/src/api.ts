import {
  type ActivateContext,
  createExporterRegistry,
  EXPORTER_SERVICE,
  type ExporterService,
} from '@vertekum/core';
import type { terrazzoManifest } from './index';
import { terrazzoExporter } from './terrazzo';

/**
 * Headless activation: contributes one exporter into the registry `@vertekum/ext-export` owns.
 *
 * Get-or-create rather than get-or-warn, so this extension works regardless of where it sits in
 * the consumer's `extensions: [...]` — the same pattern the validator registry uses (ADR-0023).
 * Listing terrazzo before the export extension would otherwise silently produce no exporter.
 */
export function activate(ctx: ActivateContext<typeof terrazzoManifest>): void {
  const existing = ctx.services.get<ExporterService>(EXPORTER_SERVICE);
  const registry = existing ?? createExporterRegistry();
  registry.register(terrazzoExporter);
  if (!existing) ctx.services.register(EXPORTER_SERVICE, registry);
}
