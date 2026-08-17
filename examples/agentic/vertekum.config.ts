import { defineConfig } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';

/**
 * A headless consumer: everything an agent needs, nothing it does not.
 *
 * This file's location is the working directory — the token collection, the system-governed
 * `.vertekum/` dir, and export output all resolve relative to it.
 *
 * Note what is NOT here. There is no `@vertekum/ext-essentials`: that bundle is a convenience for
 * the batteries-included app, and pulling it would drag in UI-only extensions. A headless project
 * names the extensions whose *capabilities* it wants — and after validation moved into core
 * (references, resolver semantics, target shapes all run with no install), that is just the
 * output formats:
 *
 *   ext-export-css   the CSS custom-properties exporter
 *
 * The token VOCABULARY is not an extension: schemas are files, named by `schemas` below. Targets
 * are ROOT config — a runner concern, owned by no extension.
 */
export default defineConfig({
  collection: './tokens',

  // The vocabulary this project is held to. Only Atlassian's COLOUR aspect, and only over the
  // semantic layer — the primitives in core.json stay unconstrained, and typography is nobody's
  // business here. That split is the usual one: a system governs the names designers and engineers
  // consume, not every raw value behind them.
  schemas: [
    {
      from: '@vertekum/schema-atlassian',
      domain: 'vocabulary',
      use: { 'color.json': 'text*.json' },
    },
  ],

  extensions: [cssExportExtension],

  // Configured, repeatable export targets (ADR-0018) — a runner concern, so they live at config
  // ROOT, owned by no extension. `vertekum build` runs these; `out` is relative to this file's
  // directory.
  targets: [
    {
      id: 'web',
      exporter: 'css',
      composition: 'default',
      out: 'build/css',
    },
  ],
});
