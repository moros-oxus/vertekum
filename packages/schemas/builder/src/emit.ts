import type { PatternRef, TreeNode } from './build';
import { dedupeSubtrees } from './dedupe';
import type { ResolvedModule } from './resolve';

/**
 * Emission — one content rule for every file:
 *
 * - PUBLIC productions emit as `$defs` PATTERNS: open at the top (`properties` +
 *   `patternProperties`, no seal), sealed as normal inside. A pattern never seals —
 *   sealing belongs to the positions that apply patterns.
 * - `root` emits as the document's `properties` — the definitive syntagma, sealed per the
 *   `sealed` pragma. In a def-scope file the root ALSO lands as `$defs.<filename>` and the
 *   document body applies it by reference, so the file stands alone AND serves as a pattern.
 * - A position that received a pattern's full member set references it (`allOf` of `$ref`s
 *   with the seal above); a merge that grew a member drops back to expansion (deep-checked).
 * - The empty sealed leaf emits once as `$defs.terminal`, referenced from every leaf.
 */

export const STAMP_PREFIX = 'built by @vertekum/schema-builder from';

export function stamp(moduleFile: string): string {
  return `${STAMP_PREFIX} ${moduleFile} — do not hand-edit; remove this comment to take ownership`;
}

type Schema = Record<string, unknown>;

const TERMINAL = 'terminal';
const PATTERN_VALVE = { '^\\$': true };

export interface EmitOptions {
  /** The module filename for the provenance stamp, e.g. `color.dfn`. */
  moduleFile: string;
  /** Explicit `id` pragma; wins over `schemaId`. */
  id?: string;
  /** Derived `$id` (configured base + artifact path) when no pragma id. */
  schemaId?: string;
  title?: string;
  description?: string;
  /** The file's nature (inline never emits). */
  scopeKind: 'document' | 'def';
  /** The document top's seal (`sealed` pragma; default true). */
  sealed: boolean;
  /** Public patterns in declaration order: def name → bare tree. */
  patterns: Map<string, TreeNode>;
  /** def-scope with a root: the root's def name (the filename). */
  rootDefName?: string;
  /** Bare tree for a pattern reference; undefined = expand instead. */
  bare?: (ref: PatternRef) => TreeNode | undefined;
  /** Linked mode: the artifact path a cross-module `$ref` should use; undefined = inline. */
  linkResolve?: (module: ResolvedModule) => string | undefined;
}

/** Structural equality of name trees — what "the pattern is still intact here" means. */
function sameTree(a: TreeNode, b: TreeNode): boolean {
  if (a.open !== b.open) return false;
  if (a.children.size !== b.children.size) return false;
  for (const [name, child] of a.children) {
    const other = b.children.get(name);
    if (!other || !sameTree(child, other)) return false;
  }
  return true;
}

interface Context {
  options: EmitOptions;
  /** Local def names that exist (patterns + rootDefName) — what `#/$defs/…` may target. */
  localDefs: Set<string>;
  /** Set when any leaf referenced `$defs.terminal` (decides whether it is emitted). */
  usedTerminal: { value: boolean };
  /** Suppress the terminal ref while emitting the terminal def's own body. */
  inTerminal: boolean;
}

/** The `$ref` string for a pattern, or undefined when it must expand. */
function refTargetOf(ref: PatternRef, ctx: Context): string | undefined {
  if (!ref.module) {
    return ctx.localDefs.has(ref.name) ? `#/$defs/${ref.name}` : undefined;
  }
  const artifact = ctx.options.linkResolve?.(ref.module);
  if (!artifact) return undefined;
  if (ref.root) {
    // A def module's ROOT is referenced as the file itself — the file IS the pattern —
    // UNLESS the author sealed the file: then the whole-file ref would drag the seal
    // into the consumer's composition, so the pointer reaches the unsealed def instead.
    const sealed = ref.module.module.meta.sealed ?? false;
    return sealed ? `${artifact}#/$defs/root` : artifact;
  }
  return `${artifact}#/$defs/${ref.name}`;
}

/**
 * Emit one position. `seal: false` only for a pattern def's own top — everything below
 * seals as normal.
 */
function position(node: TreeNode, ctx: Context, seal: boolean): Schema {
  // Linked document-child: verbatim top-level branch of a sealed artifact — bare ref.
  if (node.link && ctx.options.linkResolve) {
    const artifact = ctx.options.linkResolve(node.link.module);
    if (artifact) {
      return { $ref: `${artifact}#/properties/${node.link.top}` };
    }
  }

  // The empty sealed leaf, deduped: reference `$defs.terminal`.
  if (
    seal &&
    !ctx.inTerminal &&
    !node.open &&
    node.children.size === 0 &&
    ctx.localDefs.has(TERMINAL)
  ) {
    ctx.usedTerminal.value = true;
    return { $ref: `#/$defs/${TERMINAL}` };
  }

  // Patterns whose member sets are still intact here become `$ref`s; their members leave
  // `properties`. Open positions always expand — additions need the members spelled out.
  const refs: string[] = [];
  const covered = new Set<string>();
  if (node.patterns && !node.open) {
    for (const ref of node.patterns.values()) {
      const target = refTargetOf(ref, ctx);
      const bare = ctx.options.bare?.(ref);
      if (!target || !bare || bare.children.size === 0) continue;
      let intact = true;
      for (const [name, member] of bare.children) {
        const mine = node.children.get(name);
        if (!mine || !sameTree(member, mine)) {
          intact = false;
          break;
        }
      }
      if (!intact) continue;
      refs.push(target);
      for (const name of bare.children.keys()) covered.add(name);
    }
  }

  const properties: Schema = {};
  for (const [name, child] of node.children) {
    if (covered.has(name)) continue;
    properties[name] = position(child, ctx, true);
  }

  const schema: Schema = {};
  if (refs.length > 0) schema.allOf = refs.map(($ref) => ({ $ref }));
  schema.type = 'object';
  if (Object.keys(properties).length > 0 || refs.length === 0) {
    schema.properties = properties;
  }
  schema.patternProperties = { ...PATTERN_VALVE };
  if (node.open) {
    // Additions join the set: they take the same tail every listed member has.
    const first = node.children.values().next().value as TreeNode | undefined;
    schema.additionalProperties = first
      ? position(first, ctx, true)
      : { type: 'object', patternProperties: { ...PATTERN_VALVE } };
  } else if (seal) {
    schema.unevaluatedProperties = false;
  }
  return schema;
}

export function emit(tree: TreeNode | undefined, options: EmitOptions): string {
  const localDefs = new Set<string>(options.patterns.keys());
  if (options.rootDefName) localDefs.add(options.rootDefName);
  // The terminal dedupe steps aside on the rare production named `terminal`.
  const terminalAvailable = !localDefs.has(TERMINAL);
  if (terminalAvailable) localDefs.add(TERMINAL);

  const ctx: Context = {
    options,
    localDefs,
    usedTerminal: { value: false },
    inTerminal: false,
  };

  // Bodies first — they decide whether `$defs.terminal` is needed at all.
  const defBodies = new Map<string, Schema>();
  for (const [name, bare] of options.patterns) {
    defBodies.set(name, position(bare, ctx, false));
  }
  if (options.rootDefName && tree) {
    defBodies.set(options.rootDefName, position(tree, ctx, false));
  }
  const body: Schema | undefined =
    options.scopeKind === 'document' && tree
      ? position(tree, ctx, options.sealed)
      : options.scopeKind === 'def' && options.rootDefName
        ? {
            type: 'object',
            allOf: [{ $ref: `#/$defs/${options.rootDefName}` }],
            patternProperties: { ...PATTERN_VALVE },
            ...(options.sealed ? { unevaluatedProperties: false } : {}),
          }
        : undefined;

  const document: Schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  };
  const id = options.id ?? options.schemaId;
  if (id) document.$id = id;
  document.$comment = stamp(options.moduleFile);
  if (options.title) document.title = options.title;
  if (options.description) document.description = options.description;

  if (defBodies.size > 0 || ctx.usedTerminal.value) {
    const defs: Schema = {};
    if (ctx.usedTerminal.value && terminalAvailable) {
      defs[TERMINAL] = {
        type: 'object',
        properties: {},
        patternProperties: { ...PATTERN_VALVE },
        unevaluatedProperties: false,
      };
    }
    for (const [name, defBody] of defBodies) defs[name] = defBody;
    document.$defs = defs;
  }

  if (body) {
    if (body.allOf) document.allOf = body.allOf;
    document.type = body.type;
    if (body.properties) document.properties = body.properties;
    document.patternProperties = body.patternProperties;
    if (body.additionalProperties !== undefined) {
      document.additionalProperties = body.additionalProperties;
    }
    if (body.unevaluatedProperties !== undefined) {
      document.unevaluatedProperties = body.unevaluatedProperties;
    }
  }

  // Structural sharing: repeated tails (optional-slot syntagms) hoist into $defs once.
  dedupeSubtrees(document as Record<string, unknown>);

  return `${JSON.stringify(document, null, 2)}\n`;
}

/** True when `content` carries the generated stamp — the file is the builder's to overwrite. */
export function isStamped(content: string): boolean {
  return content.includes(STAMP_PREFIX);
}
