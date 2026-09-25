import type { Token } from '../document/types';
import { type DtcgNode, ROOT_TOKEN } from '../dtcg/parse';
import { DEFAULT_SET } from '../dtcg/serialize';
import { cloneNode, getNodeAt, setNodeAt } from '../dtcg/tree';
import type {
  CommandExtension,
  InterchangePresentationContext,
} from '../shell/types';
import { loweredNode, type TypeLoweringService } from './lowering';

/**
 * The `build` chain's consult point: one pass over the staged interchange files, offering every
 * token to the chain. A handler proposes the node exporters will SEE (e.g. a custom-typed array
 * presented as a form the downstream tool renders); the stored document is never touched. With no
 * chain this is the identity — staging stays byte-for-byte what `interchangeFiles` produced.
 *
 * This lives in core, not in any exporter bridge: `runTargets` is the one code path every client
 * drives (CLI `build`, the app's export route, programmatic callers), so a presentation registered
 * once reaches every exporter.
 *
 * Staging is per exporter: a link sees which one (`context.exporter`) and may present for it
 * alone. A token no link presents falls back to its type's LOWERING (standard DTCG children), so an
 * exporter reading files sees standard types either way.
 */
export async function presentInterchange(
  files: Record<string, DtcgNode>,
  tokens: Token[],
  extensions: CommandExtension[],
  exporter: string,
  lowerings?: TypeLoweringService,
): Promise<Record<string, DtcgNode>> {
  const lowering = lowerings !== undefined && lowerings.list().length > 0;
  if (extensions.length === 0 && !lowering) return files;

  const out: Record<string, DtcgNode> = { ...files };
  for (const token of tokens) {
    const name = `${token.set ?? DEFAULT_SET}.json`;
    const held = out[name];
    if (!held) continue;
    const original = getNodeAt(held, token.path);
    if (!original) continue;

    const context: InterchangePresentationContext = {
      token,
      exporter,
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
    if (!proposed) {
      const lowered = lowerings ? loweredNode(token, lowerings) : undefined;
      if (lowered === undefined) continue;
      context.node.current = lowered;
    }

    // Clone lazily, once per touched file — untouched files pass through by reference.
    const tree = held === files[name] ? cloneNode(held) : held;
    out[name] = tree;
    if (!proposed && token.path.at(-1) === ROOT_TOKEN) {
      // A group's own value lowers INTO the group (`$root` is a leaf name, never a parent);
      // a real child of the same name wins.
      const group = getNodeAt(tree, token.path.slice(0, -1)) as DtcgNode;
      delete group[ROOT_TOKEN];
      for (const [child, node] of Object.entries(context.node.current)) {
        if (!(child in group)) group[child] = node;
      }
      continue;
    }
    setNodeAt(tree, token.path, context.node.current);
  }
  return out;
}
