import type { ActivateContext } from '@vertekum/core';
import { schemaBuildCommand, schemaLintCommand } from './cli';
import type { schemaBuilderManifest } from './index';

export {
  assertOpenSetsAreNameSets,
  build,
  evaluateProduction,
  type TreeNode,
} from './build';
export { buildModule, schemaBuildCommand, schemaLintCommand } from './cli';
export { emit, isStamped, STAMP_PREFIX, stamp } from './emit';
export { type DfnDiagnostic, lintModule } from './lint';
export { parse } from './parser';
export { type ResolvedModule, resolveModule } from './resolve';

/** Headless activation: contributes the `schema build` and `schema lint` commands. */
export function activate(
  ctx: ActivateContext<typeof schemaBuilderManifest>,
): void {
  ctx.commands.register(schemaBuildCommand);
  ctx.commands.register(schemaLintCommand);
}
