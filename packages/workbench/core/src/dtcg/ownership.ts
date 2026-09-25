import type { ResolverDocument, Source } from '../document/resolver-types';
import type { Token } from '../document/types';
import { orderModifierName } from './resolve';

/**
 * Which modifiers OWN each token path — decided by the resolver's structure alone: a path is owned
 * by modifier M when a file referenced by ANY of M's contexts defines it. Values never enter into
 * it, so ownership does not move when a value changes (an empty default context plus overriding
 * contexts — the "override" pattern — owns its paths exactly like a modifier whose every context
 * has a file).
 *
 * Owners are listed in RESOLUTION order: the last one resolves last and wins at resolution, which
 * is why a mode-based target (one variable, one collection) models the path under it.
 */
export function modifierOwners(
  resolver: ResolverDocument,
  tokens: Token[],
): Map<string, string[]> {
  const order = modifierOrder(resolver);
  const filesOf = new Map<string, Set<string>>();
  for (const modifier of order) {
    const files = new Set<string>();
    for (const context of Object.values(
      resolver.modifiers[modifier]?.contexts ?? {},
    )) {
      for (const ref of refsOf(context)) files.add(ref.replace(/\.json$/, ''));
    }
    filesOf.set(modifier, files);
  }

  const owners = new Map<string, string[]>();
  for (const token of tokens) {
    const file = token.set ?? 'tokens';
    const path = token.path.join('.');
    for (const modifier of order) {
      if (!filesOf.get(modifier)?.has(file)) continue;
      const list = owners.get(path) ?? [];
      if (!list.includes(modifier)) list.push(modifier);
      owners.set(path, list);
    }
  }
  // Keep each list in resolution order regardless of token order.
  for (const list of owners.values()) {
    list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return owners;
}

/** Modifier names in resolution order; declared-but-unordered ones follow in declaration order. */
function modifierOrder(resolver: ResolverDocument): string[] {
  const ordered: string[] = [];
  for (const entry of resolver.resolutionOrder ?? []) {
    const ref = (entry as { $ref?: unknown }).$ref;
    if (typeof ref !== 'string') continue;
    const name = orderModifierName(ref);
    if (name !== undefined && name in resolver.modifiers) ordered.push(name);
  }
  for (const name of Object.keys(resolver.modifiers)) {
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}

function refsOf(sources: Source[]): string[] {
  return sources
    .map((s) => (s as { $ref?: unknown }).$ref)
    .filter((r): r is string => typeof r === 'string');
}
