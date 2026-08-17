import { defineExtension, type ExtensionManifest } from 'vertekum/core';
import { z } from 'zod';
import { activate } from './api';

export const TokensSettings = z.object({
  showIds: z.boolean().default(false),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
});

export const tokensManifest = {
  id: 'vtk.tokens',
  name: 'Tokens',
  settings: TokensSettings,
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/** First-party Tokens route HostExtension (trusted) — the main one. Never imports the router. */
export const tokensExtension = defineExtension<typeof tokensManifest>({
  manifest: tokensManifest,
  activate,
});
