import { defineExtension, type ExtensionManifest } from 'vertekum/core';
import { z } from 'zod';
import { activate } from './api';

/**
 * One configured export target (ADR-0018): which exporter runs, over which composition, with what
 * options, writing where. `id` defaults to `exporter`; `out` is relative to the project dir.
 */
export const TargetSchema = z.object({
  id: z.string().optional(),
  exporter: z.string(),
  composition: z.string().optional(),
  out: z.string(),
  options: z.unknown().optional(),
  enabled: z.boolean().default(true),
});

/** `vtk.export` settings: the repeatable targets `vertekum build` and the Export route run. */
export const ExportSettings = z.object({
  targets: z.array(TargetSchema).default([]),
});

export const exportManifest = {
  id: 'vtk.export',
  name: 'Export',
  settings: ExportSettings,
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/** First-party Export HostExtension (trusted): owns the exporter registry, seeds CSS, hosts /export. */
export const exportExtension = defineExtension<typeof exportManifest>({
  manifest: exportManifest,
  activate,
});
