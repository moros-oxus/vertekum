import { dashboardExtension } from '@vertekum/ext-dashboard';
import { exportExtension } from '@vertekum/ext-export';
import { cssExportExtension } from '@vertekum/ext-export-css';
import { releaseExtension } from '@vertekum/ext-release';
import { statsExtension } from '@vertekum/ext-stats';
import { themesExtension } from '@vertekum/ext-themes';
import { tokensExtension } from '@vertekum/ext-tokens';
import { valueEditorsExtension } from '@vertekum/ext-value-editors';

// Re-export each default extension so consumers can cherry-pick and configure inline
// (e.g. `import { tokensExtension } from '@vertekum/ext-essentials'`).
export { dashboardExtension } from '@vertekum/ext-dashboard';
export { exportExtension } from '@vertekum/ext-export';
export { cssExportExtension } from '@vertekum/ext-export-css';
export { releaseExtension } from '@vertekum/ext-release';
export { statsExtension } from '@vertekum/ext-stats';
export { themesExtension } from '@vertekum/ext-themes';
export { tokensExtension } from '@vertekum/ext-tokens';
export { valueEditorsExtension } from '@vertekum/ext-value-editors';

/**
 * The full default extension set, in activation order (value-editors + themes before tokens, which
 * soft-consumes their services). Spread into a config's `extensions` for the standard workbench, or
 * cherry-pick the named exports above to configure individual ones inline.
 */
export const essentials = [
  dashboardExtension,
  valueEditorsExtension,
  themesExtension,
  tokensExtension,
  exportExtension,
  cssExportExtension,
  releaseExtension,
  statsExtension,
];
