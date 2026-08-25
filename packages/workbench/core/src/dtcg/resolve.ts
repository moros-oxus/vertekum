import type {
  ResolverDocument,
  ResolverIssue,
  ResolverSelection,
  Source,
} from '../document/resolver-types';
import type { Token } from '../document/types';

const SET_REF = /^#\/sets\/(.+)$/;
const MODIFIER_REF = /^#\/modifiers\/(.+)$/;

/** The `$ref` strings of a sources array (inline, ref-less sources are skipped). */
function sourceRefs(sources: Source[]): string[] {
  return sources
    .map((s) => (s as { $ref?: unknown }).$ref)
    .filter((r): r is string => typeof r === 'string');
}

/**
 * Every set-file `$ref` a resolver mentions ANYWHERE — all sets' sources and every modifier
 * context's sources, whether or not `resolutionOrder` currently reaches them. Deliberately an
 * over-approximation: the `resolver/unreferenced-set` warning built on this must stay silent for
 * a set staged behind an unchosen context or an entry not yet ordered (order/defs mismatches are
 * `dangling-ref`'s to report, not orphanhood).
 */
export function referencedSetRefs(doc: ResolverDocument): Set<string> {
  const out = new Set<string>();
  for (const set of Object.values(doc.sets)) {
    for (const ref of sourceRefs(set.sources)) out.add(ref);
  }
  for (const modifier of Object.values(doc.modifiers)) {
    for (const context of Object.values(modifier.contexts)) {
      for (const ref of sourceRefs(context)) out.add(ref);
    }
  }
  return out;
}

/**
 * Structure-level resolution: collapse `resolutionOrder` to the ordered list of set-file `$ref`s to
 * merge (last-wins, duplicates preserved). For each modifier the chosen context is
 * `selection[name] ?? default ?? first context`. Refs to undefined defs, and modifiers with no
 * resolvable context, are skipped (defensive — `validateResolver` reports these separately).
 */
export function resolveOrder(
  doc: ResolverDocument,
  selection: ResolverSelection = {},
): string[] {
  const out: string[] = [];
  for (const { $ref } of doc.resolutionOrder) {
    const setName = SET_REF.exec($ref)?.[1];
    if (setName !== undefined) {
      const set = doc.sets[setName];
      if (set) out.push(...sourceRefs(set.sources));
      continue;
    }
    const modName = MODIFIER_REF.exec($ref)?.[1];
    if (modName !== undefined) {
      const mod = doc.modifiers[modName];
      if (!mod) continue;
      const chosen =
        selection[modName] ?? mod.default ?? Object.keys(mod.contexts)[0];
      if (chosen === undefined) continue; // 0-context modifier
      const ctx = mod.contexts[chosen];
      if (ctx) out.push(...sourceRefs(ctx));
    }
  }
  return out;
}

/**
 * Value-level resolution (merge-only): for a modifier `selection`, the winning token per path across
 * `resolveOrder`'s sets (last set wins). References are PRESERVED — call `flatten` to dereference.
 * Ordered by first appearance across the ordered sets (base position kept, value updated in place). Pure.
 */
export function resolveValues(
  resolver: ResolverDocument,
  selection: ResolverSelection,
  tokens: Token[],
): Token[] {
  const setNames = resolveOrder(resolver, selection).map((ref) =>
    ref.replace(/\.json$/, ''),
  );
  const bySet = new Map<string, Token[]>();
  for (const token of tokens) {
    const key = token.set ?? 'tokens';
    const list = bySet.get(key) ?? [];
    list.push(token);
    bySet.set(key, list);
  }
  const merged = new Map<string, Token>();
  for (const setName of setNames) {
    for (const token of bySet.get(setName) ?? []) {
      merged.set(token.path.join('.'), token);
    }
  }
  return [...merged.values()];
}

/**
 * Semantic validation of a resolver against the token sets that actually exist (`knownSetRefs`, the
 * `${set}.json` strings). Returns every issue; `severity: 'error'` should block authoring, `'warning'`
 * is advisory. Independent of `resolveOrder` — stays declarative, never throws.
 */
export function validateResolver(
  doc: ResolverDocument,
  knownSetRefs: ReadonlySet<string>,
): ResolverIssue[] {
  const issues: ResolverIssue[] = [];
  const checkSources = (
    sources: Source[],
    target: { kind: 'set' | 'modifier'; name: string },
  ) => {
    for (const ref of sourceRefs(sources)) {
      if (!knownSetRefs.has(ref)) {
        issues.push({
          code: 'unknown-source',
          severity: 'error',
          message: `Source "${ref}" is not a known token set.`,
          target,
          ref,
        });
      }
    }
  };

  for (const { $ref } of doc.resolutionOrder) {
    const setName = SET_REF.exec($ref)?.[1];
    if (setName !== undefined) {
      if (!doc.sets[setName]) {
        issues.push({
          code: 'dangling-ref',
          severity: 'error',
          message: `resolutionOrder references undefined set "${setName}".`,
          target: { kind: 'set', name: setName },
        });
      }
      continue;
    }
    const modName = MODIFIER_REF.exec($ref)?.[1];
    if (modName !== undefined && !doc.modifiers[modName]) {
      issues.push({
        code: 'dangling-ref',
        severity: 'error',
        message: `resolutionOrder references undefined modifier "${modName}".`,
        target: { kind: 'modifier', name: modName },
      });
    }
  }

  for (const [name, set] of Object.entries(doc.sets)) {
    checkSources(set.sources, { kind: 'set', name });
  }

  for (const [name, mod] of Object.entries(doc.modifiers)) {
    const target = { kind: 'modifier' as const, name };
    const keys = Object.keys(mod.contexts);
    if (keys.length === 0) {
      issues.push({
        code: 'empty-contexts',
        severity: 'error',
        message: `Modifier "${name}" must have at least one context.`,
        target,
      });
    } else if (keys.length === 1) {
      issues.push({
        code: 'single-context',
        severity: 'warning',
        message: `Modifier "${name}" has only one context.`,
        target,
      });
    }
    if (
      mod.default !== undefined &&
      !Object.hasOwn(mod.contexts, mod.default)
    ) {
      issues.push({
        code: 'bad-default',
        severity: 'error',
        message: `Modifier "${name}" default "${mod.default}" is not one of its contexts.`,
        target,
      });
    }
    for (const sources of Object.values(mod.contexts)) {
      checkSources(sources, target);
    }
  }

  return issues;
}
