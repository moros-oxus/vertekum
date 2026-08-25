import { basename } from 'node:path';
import { evaluateScale } from '@vertekum/core';
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
  /**
   * PATTERNS whose full member sets landed at this position — unmodified terminal
   * references to public productions (local or imported) or to an imported def-scope
   * module's root. Emission deep-checks each against the position's children and, when
   * intact, emits a `$ref` to the pattern's `$def` instead of expanding; a merge that
   * grew a member drops the pattern back to expansion. Keyed collision-proof.
   */
  patterns?: Map<string, PatternRef>;
  /**
   * This subtree is verbatim one top-level branch of an imported DOCUMENT module's own
   * artifact. Emission MAY replace it with a `$ref` into `…#/properties/<top>` (linked
   * mode); inline mode ignores the tag.
   */
  link?: { module: ResolvedModule; top: string };
}

/** One pattern source: a production (local when `module` is absent) or a def-scope root. */
export interface PatternRef {
  name: string;
  module?: ResolvedModule;
  /** The pattern is the module's ROOT def (`$defs.<filename>`), not a production. */
  root?: boolean;
}

const leaf = (): TreeNode => ({ children: new Map(), open: false });

function merge(into: TreeNode, from: TreeNode): void {
  into.open = into.open || from.open;
  into.link = undefined;
  if (from.patterns) {
    into.patterns = into.patterns ?? new Map();
    for (const [key, ref] of from.patterns) into.patterns.set(key, ref);
  }
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
  /** Lint's warning sink (open-merge, …); absent in plain builds. */
  warn?: (file: string, line: number, column: number, message: string) => void;
}

/** The `<@key/name>, …` listing a miss suggests — an error should name the fix, not just the gap. */
function productionsOf(key: string, imported: ResolvedModule): string {
  return [...imported.module.productions.keys()]
    .filter((p) => !imported.module.private.has(p))
    .map((p) => `<@${key}/${p}>`)
    .join(', ');
}

/** Find what `<name>` / `<@name>` means in this scope. Imported roots go by module name. */
function target(
  ref: Ref,
  scope: Scope,
): { node: Node; scope: Scope; importedRoot?: ResolvedModule } {
  // Every error here names the module whose TEXT holds the ref — `scope.module` — so a
  // failure inside an imported production's body is attributed to that file, not to
  // whichever module the walk started from.
  const file = scope.module.path;
  if (!ref.imported) {
    const production = scope.module.module.productions.get(ref.name);
    if (!production) {
      throw new DfnError(
        `unknown production '<${ref.name}>'`,
        ref.line,
        ref.column,
        file,
      );
    }
    return { node: production, scope };
  }

  // Qualified: `<@module/production>` looks in that import alone — the collision resolver.
  if (ref.from) {
    const imported = scope.module.imports.get(ref.from);
    if (!imported) {
      throw new DfnError(
        `no import named '${ref.from}'`,
        ref.line,
        ref.column,
        file,
      );
    }
    const production = imported.module.productions.get(ref.name);
    if (production && imported.module.private.has(ref.name)) {
      throw new DfnError(
        `'${ref.name}' is private to ${basename(imported.path)} — its public productions: ${productionsOf(ref.from, imported)}`,
        ref.line,
        ref.column,
        file,
      );
    }
    if (!production) {
      throw new DfnError(
        `'${ref.from}' has no production '${ref.name}' — it declares: ${productionsOf(ref.from, imported)}`,
        ref.line,
        ref.column,
        file,
      );
    }
    return {
      node: production,
      scope: { module: imported, expanding: new Set(), warn: scope.warn },
    };
  }

  // 1. A module KEY match wins outright — a keyed module cannot be shadowed by (or
  //    collide with) sibling imports' productions. Its root; else its OWN production of
  //    the same name (the fragment-declares-its-own-name idiom); else the fragment hint.
  const keyed = scope.module.imports.get(ref.name);
  if (keyed) {
    const keyedScope: Scope = {
      module: keyed,
      expanding: new Set(),
      warn: scope.warn,
    };
    if (keyed.module.root) {
      return {
        node: keyed.module.root,
        scope: keyedScope,
        importedRoot: keyed,
      };
    }
    const own = keyed.module.productions.get(ref.name);
    if (own && !keyed.module.private.has(ref.name)) {
      return { node: own, scope: keyedScope };
    }
    throw new DfnError(
      `'${ref.name}' is imported, but it declares no root (a fragment) — reference one of its productions: ${productionsOf(ref.name, keyed)}`,
      ref.line,
      ref.column,
      file,
    );
  }

  // 2. No key match: the production searched across every import — unambiguous or say so.
  const hits: Array<{
    node: Node;
    scope: Scope;
    importedRoot?: ResolvedModule;
  }> = [];
  for (const imported of scope.module.imports.values()) {
    const production = imported.module.productions.get(ref.name);
    if (production && !imported.module.private.has(ref.name)) {
      hits.push({
        node: production,
        scope: { module: imported, expanding: new Set(), warn: scope.warn },
      });
    }
  }
  if (hits.length === 0) {
    throw new DfnError(
      `no import provides '<@${ref.name}>'`,
      ref.line,
      ref.column,
      file,
    );
  }
  if (hits.length > 1) {
    throw new DfnError(
      `'<@${ref.name}>' is ambiguous across imports — qualify it: <@module/${ref.name}>`,
      ref.line,
      ref.column,
      file,
    );
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
      // One authority for scale names (and, later, token values): core's evaluateScale.
      let scale: ReturnType<typeof evaluateScale>;
      try {
        scale = evaluateScale(
          node.mode === 'stepped'
            ? {
                kind: 'stepped',
                min: node.min,
                max: node.max,
                step: node.step,
                pad: node.pad,
                prefix: node.prefix,
                suffix: node.suffix,
              }
            : {
                kind: 'multiplied',
                min: node.min,
                max: node.max,
                factor: node.step,
                quantum: node.quantum,
                pad: node.pad,
                prefix: node.prefix,
                suffix: node.suffix,
              },
        );
      } catch (error) {
        throw new DfnError(
          error instanceof Error ? error.message : String(error),
          node.line,
          node.column,
          scope.module.path,
        );
      }
      if (scale.collisions.length > 0) {
        throw new DfnError(
          `scale steps ${scale.collisions.join(', ')} quantize onto earlier names — the quantum is too coarse for the factor`,
          node.line,
          node.column,
          scope.module.path,
        );
      }
      const forest = leaf();
      for (const name of scale.names) {
        forest.children.set(name, tail());
      }
      return forest;
    }
    case 'alt': {
      const forest = leaf();
      const forests = node.options.map((option) => ({
        option,
        forest: evaluate(option, scope, tail),
      }));
      // Opening a subset of a position's set opens the WHOLE position — additions carry
      // no mark of which family they claim. Legal, but never silent.
      const open = forests.find((f) => f.forest.open);
      const closed = forests.find(
        (f) => !f.forest.open && f.forest.children.size > 0,
      );
      if (open && closed && scope.warn) {
        const at = open.option as { line?: number; column?: number };
        scope.warn(
          scope.module.path,
          at.line ?? 1,
          at.column ?? 1,
          'an open set merges with closed siblings here — the whole position becomes open (additions are permitted beside every member)',
        );
      }
      for (const f of forests) merge(forest, f.forest);
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
      const {
        node: production,
        scope: refScope,
        importedRoot,
      } = target(node, scope);
      if (!node.imported) {
        if (scope.expanding.has(node.name)) {
          throw new DfnError(
            `'<${node.name}>' expands through itself`,
            node.line,
            node.column,
            scope.module.path,
          );
        }
        scope.expanding.add(node.name);
      }
      const forest = evaluate(production, refScope, tail);
      if (!node.imported) scope.expanding.delete(node.name);
      // Set-valued operands: a member REFERENCE contributes every top-level name of the
      // set it denotes (evaluated in this scope, privacy and all); strings pass through.
      const expandOperands = (list: Ref['omit']): string[] => {
        const out: string[] = [];
        for (const member of list) {
          if (typeof member === 'string') {
            out.push(member);
            continue;
          }
          const operand = evaluate(member, scope, leaf);
          for (const name of operand.children.keys()) out.push(name);
        }
        return out;
      };
      for (const omitted of expandOperands(node.omit)) {
        if (!forest.children.delete(omitted)) {
          throw new DfnError(
            `'<${node.name}>' has no member '${omitted}' to omit`,
            node.line,
            node.column,
            scope.module.path,
          );
        }
      }
      if (node.pick.length > 0) {
        const picks = expandOperands(node.pick);
        for (const picked of picks) {
          if (!forest.children.has(picked)) {
            throw new DfnError(
              `'<${node.name}>' has no member '${picked}' to pick`,
              node.line,
              node.column,
              scope.module.path,
            );
          }
        }
        const keep = new Set(picks);
        for (const name of [...forest.children.keys()]) {
          if (!keep.has(name)) forest.children.delete(name);
        }
      }
      if (node.open) forest.open = true;
      const unmodified =
        node.pick.length === 0 && node.omit.length === 0 && !node.open;
      // A modified set is a different set — it never shares a pattern's $def; a tail
      // forces expansion (a $ref cannot be parameterized). Tags are inert unless
      // emission chooses to reference them.
      if (unmodified && isTerminal(tail())) {
        if (importedRoot) {
          const nature =
            importedRoot.module.meta.scope ??
            (importedRoot.module.root ? 'document' : 'def');
          if (nature === 'document') {
            // Verbatim top-level branches of the child DOCUMENT's artifact.
            for (const [top, child] of forest.children) {
              child.link = { module: importedRoot, top };
            }
          } else if (nature === 'def') {
            forest.patterns = forest.patterns ?? new Map();
            forest.patterns.set(`@${importedRoot.path}//root`, {
              name: importedRoot.name,
              module: importedRoot,
              root: true,
            });
          }
          // inline nature: pure expansion, no tag.
        } else if (!node.imported) {
          if (!scope.module.module.private.has(node.name)) {
            forest.patterns = forest.patterns ?? new Map();
            forest.patterns.set(node.name, { name: node.name });
          }
        } else {
          // An imported PRODUCTION (qualified or search-resolved): public by
          // construction (target refuses privates). Pattern in the child's artifact
          // unless the child is inline-natured.
          const child = refScope.module;
          const nature =
            child.module.meta.scope ?? (child.module.root ? 'document' : 'def');
          if (nature !== 'inline') {
            forest.patterns = forest.patterns ?? new Map();
            forest.patterns.set(`@${child.path}/${node.name}`, {
              name: node.name,
              module: child,
            });
          }
        }
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
    case 'group':
      // Decorative brackets do not change a set's nature.
      return isNameSet(node.node);
    default:
      return false;
  }
}

function isTerminal(node: TreeNode): boolean {
  return node.children.size === 0;
}

/** Expand a module's root into its name tree. Fragments-only modules cannot build. */
export function build(
  resolved: ResolvedModule,
  options: {
    warn?: (
      file: string,
      line: number,
      column: number,
      message: string,
    ) => void;
  } = {},
): TreeNode {
  const root = resolved.module.root;
  if (!root) {
    throw new DfnError(
      `${resolved.name}.dfn declares no root`,
      1,
      1,
      resolved.path,
    );
  }
  const scope: Scope = {
    module: resolved,
    expanding: new Set(),
    warn: options.warn,
  };

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
            option.line,
            option.column,
            resolved.path,
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
 * Expand ONE production in isolation — the lint walk's unit. `build` stays root-only; this is what
 * lets a fragment's productions (and a rooted module's unused ones) be validated at all. Seeding
 * `expanding` with the production's own name makes direct self-reference a cycle, same as it is
 * when reached from a root.
 */
export function evaluateProduction(
  resolved: ResolvedModule,
  name: string,
  warn?: (file: string, line: number, column: number, message: string) => void,
): TreeNode {
  const production = resolved.module.productions.get(name);
  if (!production) {
    throw new DfnError(`no production '${name}'`, 1, 1);
  }
  const scope: Scope = {
    module: resolved,
    expanding: new Set([name]),
    warn,
  };
  return evaluate(production, scope, leaf);
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
        throw new DfnError(
          '* opens a set of names, not sub-paths',
          node.line,
          node.column,
          scope.module.path,
        );
      }
      assertOpenSetsAreNameSets(resolved, node.node, scope);
      return;
    case 'ref': {
      if (node.open) {
        const { node: production } = target(node, scope);
        if (!isNameSet(production)) {
          throw new DfnError(
            `'<${node.name}*>' opens a set, but the production is not name-only`,
            node.line,
            node.column,
            scope.module.path,
          );
        }
      }
      return;
    }
    default:
      return;
  }
}
