import {
  type ActivateContext,
  EXPORTER_SERVICE,
  type ExporterService,
} from '@vertekum/core';
import { figmaExporter } from './figma';
import type { figmaManifest } from './index';

/**
 * Headless activation: contributes one exporter. The kernel seeds the registry before any
 * extension activates, so activation order never matters — get and register, nothing more.
 */
export function activate(ctx: ActivateContext<typeof figmaManifest>): void {
  ctx.services.get<ExporterService>(EXPORTER_SERVICE)?.register(figmaExporter);
}
