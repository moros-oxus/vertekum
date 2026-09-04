import {
  type ActivateContext,
  EXPORTER_SERVICE,
  type ExporterService,
} from '@vertekum/core';
import { cssExporter } from './css';
import type { cssExportManifest } from './index';

/**
 * Headless activation: contributes one exporter. The kernel seeds the registry before any
 * extension activates, so activation order never matters — get and register, nothing more.
 */
export function activate(ctx: ActivateContext<typeof cssExportManifest>): void {
  ctx.services.get<ExporterService>(EXPORTER_SERVICE)?.register(cssExporter);
}
