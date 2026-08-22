import type { ActivateContext } from '@vertekum/core';
import { schemaBuildCommand, schemaFmtCommand, schemaLintCommand } from './cli';
import type { schemaBuilderManifest } from './index';

export {
  assertOpenSetsAreNameSets,
  build,
  evaluateProduction,
  type TreeNode,
} from './build';
export {
  buildModule,
  schemaBuildCommand,
  schemaFmtCommand,
  schemaLintCommand,
} from './cli';
export { emit, isStamped, STAMP_PREFIX, stamp } from './emit';
export {
  type DfnFix,
  type FormatOptions,
  fixSource,
  formatSource,
  resolveIndent,
} from './format';
export { type DfnDiagnostic, lintModule } from './lint';
export { parse } from './parser';
export { type ResolvedModule, resolveModule } from './resolve';

/** Headless activation: contributes the `schema build`, `schema lint`, and `schema fmt` commands. */
export function activate(
  ctx: ActivateContext<typeof schemaBuilderManifest>,
): void {
  ctx.commands.register(schemaBuildCommand);
  ctx.commands.register(schemaLintCommand);
  ctx.commands.register(schemaFmtCommand);
}
