import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';
import { DEFAULT_SET } from '../dtcg/serialize';
import { cloneNode, getNodeAt, setNodeAt } from '../dtcg/tree';
import type {
  CommandExtension,
  InterchangePresentationContext,
} from '../shell/types';

/**
 * The `build` chain's consult point: one pass over the staged interchange files, offering every
 * token to the chain. A handler proposes the node exporters will SEE (e.g. a custom-typed array
 * presented as a form the downstream tool renders); the stored document is never touched. With no
 * chain this is the identity — staging stays byte-for-byte what `interchangeFiles` produced.
 *
 * This lives in core, not in any exporter bridge: `runTargets` is the one code path every client
 * drives (CLI `build`, the app's export route, programmatic callers), so a presentation registered
 * once reaches every exporter.
 */
export async function presentInterchange(
  files: Record<string, DtcgNode>,
  tokens: Token[],
  extensions: CommandExtension[],
): Promise<Record<string, DtcgNode>> {
  if (extensions.length === 0) return files;

  const out: Record<string, DtcgNode> = { ...files };
  for (const token of tokens) {
    const name = `${token.set ?? DEFAULT_SET}.json`;
    const held = out[name];
    if (!held) continue;
    const original = getNodeAt(held, token.path);
    if (!original) continue;

    const context: InterchangePresentationContext = {
      token,
      node: { original, current: original },
    };
    let proposed = false;
    for (const link of extensions) {
      const proposal = (await link.handle(context)) as DtcgNode | undefined;
      if (proposal !== undefined) {
        context.node.current = proposal;
        proposed = true;
      }
    }
    if (!proposed) continue;

    // Clone lazily, once per touched file — untouched files pass through by reference.
    const tree = held === files[name] ? cloneNode(held) : held;
    out[name] = tree;
    setNodeAt(tree, token.path, context.node.current);
  }
  return out;
}
