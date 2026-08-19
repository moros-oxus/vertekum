import type { ActivateContext } from '@vertekum/core';
import { schemaBuildCommand } from './cli';
import type { schemaBuilderManifest } from './index';

export { assertOpenSetsAreNameSets, build, type TreeNode } from './build';
export { buildModule, schemaBuildCommand } from './cli';
export { emit, isStamped, STAMP_PREFIX, stamp } from './emit';
export { parse } from './parser';
export { type ResolvedModule, resolveModule } from './resolve';

/** Headless activation: contributes the `schema build` command and nothing else. */
export function activate(
  ctx: ActivateContext<typeof schemaBuilderManifest>,
): void {
  ctx.commands.register(schemaBuildCommand);
}
