import type { Node, Ref } from './ast';
import { DfnError } from './error';
import type { ResolvedModule } from './resolve';

/**
 * The expanded name tree a root permits. `open` marks a position whose child SET admits additions
 * (every member, listed or added, takes the same tail). `denotation` names the terminal
 * denotation this subtree came from — emission turns multi-use denotations into `$defs`.
 */
export interface TreeNode {
  children: Map<string, TreeNode>;
  open: boolean;
  denotation?: string;
}

const leaf = (): TreeNode => ({ children: new Map(), open: false });

function merge(into: TreeNode, from: TreeNode): void {
  into.open = into.open || from.open;
  if (into.denotation !== from.denotation) into.denotation = undefined;
  for (const [name, child] of from.children) {
    const existing = into.children.get(name);
    if (existing) merge(existing, child);
    else into.children.set(name, child);
  }
}

/** Evaluation scope: the module whose productions and imports are in view. */
interface Scope {
  module: ResolvedModule;
  /** Local productions currently expanding, for reference-cycle detection. */
  expanding: Set<string>;
}

/** Find what `<name>` / `<@name>` means in this scope. Imported roots go by module name. */
function target(ref: Ref, scope: Scope): { node: Node; scope: Scope } {
  if (!ref.imported) {
    const production = scope.module.module.productions.get(ref.name);
    if (!production) {
      throw new DfnError(`unknown production '<${ref.name}>'`, 1, 1);
    }
    return { node: production, scope };
  }

  const hits: Array<{ node: Node; scope: Scope }> = [];
  for (const imported of scope.module.imports.values()) {
    const importedScope: Scope = { module: imported, expanding: new Set() };
    const production = imported.module.productions.get(ref.name);
    if (production) hits.push({ node: production, scope: importedScope });
    if (imported.name === ref.name && imported.module.root) {
      hits.push({ node: imported.module.root, scope: importedScope });
    }
  }
  if (hits.length === 0) {
    throw new DfnError(`no import provides '<@${ref.name}>'`, 1, 1);
  }
  if (hits.length > 1) {
    throw new DfnError(`'<@${ref.name}>' is ambiguous across imports`, 1, 1);
  }
  return hits[0];
}

/**
 * Evaluate a node to the forest of names it permits, each with its subtree. `tail` is what hangs
 * beneath every name this node produces — how `a.<set>.b` threads `b` under each member of the
 * set, which is also what makes an open set's additions well-defined.
 */
function evaluate(node: Node, scope: Scope, tail: () => TreeNode): TreeNode {
  switch (node.kind) {
    case 'name': {
      const forest = leaf();
      forest.children.set(node.value, tail());
      return forest;
    }
    case 'range': {
      const forest = leaf();
      for (let n = node.min; n <= node.max; n += node.step) {
        forest.children.set(String(n), tail());
      }
      return forest;
    }
    case 'alt': {
      const forest = leaf();
      for (const option of node.options) {
        merge(forest, evaluate(option, scope, tail));
      }
      return forest;
    }
    case 'path': {
      // Steps expand right to left: each step becomes the tail of the one before it. An
      // optional step (`?`) may be SKIPPED — its tail also attaches directly, so
      // `<role>.<emphasis>?.<interaction>?` grants the whole slot-collapse lattice.
      let next = tail;
      for (let i = node.steps.length - 1; i > 0; i--) {
        const step = node.steps[i];
        const after = next;
        next = step.optional
          ? () => {
              const forest = evaluate(step.term, scope, after);
              merge(forest, after());
              return forest;
            }
          : () => evaluate(step.term, scope, after);
      }
      const first = node.steps[0];
      const forest = evaluate(first.term, scope, next);
      if (first.optional) merge(forest, next());
      return forest;
    }
    case 'group': {
      const forest = evaluate(node.node, scope, tail);
      if (node.open) forest.open = true;
      return forest;
    }
    case 'ref': {
      const { node: production, scope: refScope } = target(node, scope);
      if (!node.imported) {
        if (scope.expanding.has(node.name)) {
          throw new DfnError(`'<${node.name}>' expands through itself`, 1, 1);
        }
        scope.expanding.add(node.name);
      }
      const forest = evaluate(production, refScope, tail);
      if (!node.imported) scope.expanding.delete(node.name);
      for (const omitted of node.omit) {
        if (!forest.children.delete(omitted)) {
          throw new DfnError(
            `'<${node.name}>' has no member '${omitted}' to omit`,
            1,
            1,
          );
        }
      }
      if (node.pick.length > 0) {
        for (const picked of node.pick) {
          if (!forest.children.has(picked)) {
            throw new DfnError(
              `'<${node.name}>' has no member '${picked}' to pick`,
              1,
              1,
            );
          }
        }
        const keep = new Set(node.pick);
        for (const name of [...forest.children.keys()]) {
          if (!keep.has(name)) forest.children.delete(name);
        }
      }
      if (node.open) forest.open = true;
      // A modified set is a different set — it never shares the source denotation's $def.
      if (
        node.pick.length === 0 &&
        node.omit.length === 0 &&
        isNameSet(production) &&
        isTerminal(tail())
      ) {
        forest.denotation = node.name;
      }
      return forest;
    }
  }
}

/** A production of names/ranges only — the sets `*` may open and `$defs` may name. */
function isNameSet(node: Node): boolean {
  switch (node.kind) {
    case 'name':
    case 'range':
      return true;
    case 'alt':
      return node.options.every(isNameSet);
    default:
      return false;
  }
}

function isTerminal(node: TreeNode): boolean {
  return node.children.size === 0;
}

/** Expand a module's root into its name tree. Fragments-only modules cannot build. */
export function build(resolved: ResolvedModule): TreeNode {
  const root = resolved.module.root;
  if (!root) {
    throw new DfnError(`${resolved.name}.dfn declares no root`, 1, 1);
  }
  const scope: Scope = { module: resolved, expanding: new Set() };

  // An aggregate root unions imported roots; the same top-level name arriving from two different
  // module refs is a collision, not a merge — each module owns its top. `[a | b]` and `a | b`
  // are the same aggregate, so a root-level group unwraps first.
  const aggregate = root.kind === 'group' ? root.node : root;
  if (aggregate.kind === 'alt') {
    const seen = new Map<string, string>();
    for (const option of aggregate.options) {
      if (option.kind !== 'ref' || !option.imported) continue;
      const forest = evaluate(option, scope, leaf);
      for (const name of forest.children.keys()) {
        const owner = seen.get(name);
        if (owner && owner !== option.name) {
          throw new DfnError(
            `top-level '${name}' comes from both '${owner}' and '${option.name}'`,
            1,
            1,
          );
        }
        seen.set(name, option.name);
      }
    }
  }

  const tree = evaluate(root, scope, leaf);
  // Open markers on the root's own set have no parent position to attach to.
  tree.open = false;
  return tree;
}

/**
 * Enforce that every `*` sat on a name-only set: evaluation flags are structural, so the check is
 * on the AST — walk refs/groups marked open and verify their expansion source.
 */
export function assertOpenSetsAreNameSets(
  resolved: ResolvedModule,
  node: Node | undefined = resolved.module.root,
  scope: Scope = { module: resolved, expanding: new Set() },
): void {
  if (!node) return;
  switch (node.kind) {
    case 'alt':
      for (const option of node.options) {
        assertOpenSetsAreNameSets(resolved, option, scope);
      }
      return;
    case 'path':
      for (const step of node.steps) {
        assertOpenSetsAreNameSets(resolved, step.term, scope);
      }
      return;
    case 'group':
      if (node.open && !isNameSet(node.node)) {
        throw new DfnError('* opens a set of names, not sub-paths', 1, 1);
      }
      assertOpenSetsAreNameSets(resolved, node.node, scope);
      return;
    case 'ref': {
      if (node.open) {
        const { node: production } = target(node, scope);
        if (!isNameSet(production)) {
          throw new DfnError(
            `'<${node.name}*>' opens a set, but the production is not name-only`,
            1,
            1,
          );
        }
      }
      return;
    }
    default:
      return;
  }
}
