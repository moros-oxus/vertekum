import {
  defineExtension,
  type ExtensionManifest,
  type ReleaseNotes,
  type Severity,
} from 'vertekum/core';
import { z } from 'zod';
import { activate } from './api';

/** Info passed to a `commit` message-builder function. */
export interface CommitInfo {
  version: string;
  bump: Severity | null;
  notes: ReleaseNotes;
}

const CommitFn = z.custom<(info: CommitInfo) => string>(
  (v) => typeof v === 'function',
);

const GitProviderOptions = z.object({
  commit: z.union([z.boolean(), CommitFn]).default(false),
  tag: z.boolean().default(false),
  bumpPackage: z.boolean().default(false),
});

const LockProviderOptions = z.object({
  lockPath: z.string().default('.vertekum/release.lock.json'),
});

/**
 * `vtk.release` settings. `changelog` is a shared top-level concern (both providers write it);
 * `providerOptions` is shaped by `provider` — a `.transform` re-parses it with the matching schema,
 * so `{}` still parses (the config engine relies on that fallback).
 */
export const ReleaseSettings = z
  .object({
    changelog: z
      .union([
        z.literal(false),
        z.object({
          changelogPath: z.string().default('.vertekum/CHANGELOG.md'),
        }),
      ])
      .default({ changelogPath: '.vertekum/CHANGELOG.md' }),
    provider: z.enum(['lock', 'git']).default('lock'),
    providerOptions: z.unknown().optional(),
  })
  .transform((s) => ({
    changelog: s.changelog,
    provider: s.provider,
    providerOptions:
      s.provider === 'git'
        ? GitProviderOptions.parse(s.providerOptions ?? {})
        : LockProviderOptions.parse(s.providerOptions ?? {}),
  }));

export type ReleaseSettings = z.infer<typeof ReleaseSettings>;
export type ChangelogConfig = ReleaseSettings['changelog'];
export type GitOptions = z.infer<typeof GitProviderOptions>;
export type LockOptions = z.infer<typeof LockProviderOptions>;

export const releaseManifest = {
  id: 'vtk.release',
  name: 'Release',
  settings: ReleaseSettings,
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party Release route HostExtension (trusted). Publishes the active ReleaseProvider as a
 * service (ADR-0023) — the concrete provider (lock-file or git) is a config-selected swap. The
 * changelog path and git toggles are read from config at cut-release time.
 */
export const releaseExtension = defineExtension<typeof releaseManifest>({
  manifest: releaseManifest,
  activate,
});
