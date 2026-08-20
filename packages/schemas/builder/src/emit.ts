import type { TreeNode } from './build';

/**
 * Emit a name tree as the names-and-order JSON Schema shape shipped schemas use: every position
 * `type: object`, declared children under `properties`, `$`-members passing via
 * `patternProperties`, and closure via `unevaluatedProperties: false` — except open positions,
 * which route additions to the members' shared tail through `additionalProperties` instead.
 * Terminal denotation refs used more than once become `$defs`, matching the hand-written style.
 */

export const STAMP_PREFIX = 'built by @vertekum/schema-builder from';

export function stamp(moduleFile: string): string {
  return `${STAMP_PREFIX} ${moduleFile} — do not hand-edit; remove this comment to take ownership`;
}

type Schema = Record<string, unknown>;

function countDenotations(node: TreeNode, counts: Map<string, number>): void {
  if (node.denotation) {
    counts.set(node.denotation, (counts.get(node.denotation) ?? 0) + 1);
  }
  for (const child of node.children.values()) countDenotations(child, counts);
}

function position(node: TreeNode, defs: Set<string>): Schema {
  if (node.denotation && defs.has(node.denotation)) {
    return { $ref: `#/$defs/${node.denotation}` };
  }
  const properties: Schema = {};
  for (const [name, child] of node.children) {
    properties[name] = position(child, defs);
  }
  const schema: Schema = {
    type: 'object',
    properties,
    patternProperties: { '^\\$': true },
  };
  if (node.open) {
    // Additions join the set: they take the same tail every listed member has. All members share
    // it by construction (`*` is restricted to name-only sets), so the first child is the shape.
    const first = node.children.values().next().value as TreeNode | undefined;
    schema.additionalProperties = first
      ? position(first, defs)
      : { type: 'object', patternProperties: { '^\\$': true } };
  } else {
    schema.unevaluatedProperties = false;
  }
  return schema;
}

/** The $def body for a denotation node: its own position schema, never self-referential. */
function definition(node: TreeNode, defs: Set<string>): Schema {
  const bare: TreeNode = { ...node, denotation: undefined };
  return position(bare, defs);
}

export interface EmitOptions {
  /** The module filename for the provenance stamp, e.g. `house.dfn`. */
  moduleFile: string;
  /** From the module's pragmas: `id "…"`, `title "…"`, `description "…"`, `scope "…"`. */
  id?: string;
  title?: string;
  description?: string;
  scope?: 'document' | 'branch';
}

export function emit(tree: TreeNode, options: EmitOptions): string {
  const counts = new Map<string, number>();
  countDenotations(tree, counts);
  const shared = new Set(
    [...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name),
  );

  const document: Schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  };
  if (options.id) document.$id = options.id;
  document.$comment = stamp(options.moduleFile);
  if (options.title) document.title = options.title;
  if (options.description) document.description = options.description;

  if (shared.size > 0) {
    const defs: Schema = {};
    const collect = (node: TreeNode): void => {
      if (
        node.denotation &&
        shared.has(node.denotation) &&
        !(node.denotation in defs)
      ) {
        defs[node.denotation] = definition(node, shared);
      }
      for (const child of node.children.values()) collect(child);
    };
    collect(tree);
    document.$defs = defs;
  }

  const root = position(tree, shared);
  document.type = root.type;
  document.properties = root.properties;
  document.patternProperties = root.patternProperties;
  // `scope "branch"`: govern only the named top-level branches — the document root stays
  // unsealed so sibling vocabularies can bind over the same files. Default seals.
  if (options.scope !== 'branch') {
    document.unevaluatedProperties = root.unevaluatedProperties;
  }

  return `${JSON.stringify(document, null, 2)}\n`;
}

/** True when `content` carries the generated stamp — the file is the builder's to overwrite. */
export function isStamped(content: string): boolean {
  return content.includes(STAMP_PREFIX);
}
