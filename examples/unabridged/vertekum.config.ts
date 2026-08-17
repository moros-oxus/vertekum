import {
  cssExportExtension,
  dashboardExtension,
  exportExtension,
  releaseExtension,
  statsExtension,
  themesExtension,
  tokensExtension,
  valueEditorsExtension,
} from '@vertekum/ext-essentials';
import { defineConfig } from 'vertekum';

/**
 * Reference Vertekum config for the `examples/unabridged` consumer.
 *
 * This file's location is the WORKING DIRECTORY — the system does its work here: token collection,
 * the system-governed `.vertekum/` dir (settings + release lock), the CHANGELOG, and export outputs
 * all resolve relative to this file.
 *
 * Extensions are configured INLINE, Vite-plugin style: call an extension with its settings, e.g.
 * `tokensExtension({ showIds: true })`. Options become tier-2 host overrides (the user can still
 * override them at runtime, and the Settings UI edits them live). Listed uncalled = defaults only.
 * In a real project the system merges the app's `defaultConfig` underneath, so you only need the
 * parts you change — e.g. `defineConfig({ collection })`.
 */
export default defineConfig({
  // Where your DTCG token files live, relative to this config file. Default: './tokens'
  collection: './tokens',

  // Configured, repeatable export targets (ADR-0018) — a runner concern, so they live at config
  // ROOT. `vertekum build` runs these; `out` is relative to THIS file's directory.
  targets: [
    {
      id: 'web',
      exporter: 'css',
      composition: 'default',
      out: 'build/css',
    },
  ],

  extensions: [
    // no config/settings
    dashboardExtension,
    themesExtension,
    // The /export route (UI, deferred). The CSS exporter itself is @vertekum/ext-export-css;
    // targets are ROOT config (below), not extension settings.
    exportExtension,
    cssExportExtension,
    // config explicitly omitted (defaults)
    valueEditorsExtension,
    // configured inline (showing defaults)
    tokensExtension({ showIds: false, density: 'comfortable' }),
    releaseExtension({
      // The changelog is shared across providers; set to `false` to disable it.
      changelog: { changelogPath: '.vertekum/CHANGELOG.md' },
      // 'lock' (default): the baseline is a committed `.vertekum/release.lock.json` snapshot.
      // 'git': the baseline is the token files at the last `v*` tag — no lock file.
      provider: 'lock',
      // Shape follows `provider`. Fields with schema defaults may be omitted — for lock, the
      // snapshot path defaults to `.vertekum/release.lock.json`.
      providerOptions: {},
      // For a git-based project, swap the two lines above for:
      //   provider: 'git',
      //   providerOptions: {
      //     commit: true, // or ({ version }) => `chore(tokens): release ${version}`
      //     tag: true,
      //     bumpPackage: false,
      //   },
      // Every git write action defaults to false — hands-off: it writes the changelog and
      // leaves the commit + tag to you (turn them on to have the app drive git).
    }),
    statsExtension,
  ],
});
