/**
 * Build a JSON Schema from a list of dotted token names.
 *
 * The vocabulary governs NAMES AND ORDER: which names may appear, in what order, and where the
 * order ends. What a granted name IS — a group, a `$value` token, a `$ref` token, a group
 * carrying `$root` — is the token author's choice, policed by the DTCG format schema validating
 * the same files in parallel, never by this one. `$root` and `$value` on a granted name mint
 * nothing: the token they create IS the granted name.
 *
 * Hence one position shape, everywhere:
 *
 *   { "properties": { …granted names… },
 *     "patternProperties": { "^\\$": true },
 *     "unevaluatedProperties": false }
 *
 * The plain `^\$` passthrough is the REPRESENTATION VALVE — every `$`-key passes this schema
 * unjudged and the format schema judges it. A terminus ("the last name in the order") is the same
 * shape with zero granted names: it refuses further names and says nothing about representation.
 *
 * `.$root` suffixes in the source name list mark where the source system defines base values;
 * they are stripped here on purpose — the record stays in `vocabulary.json`, the schema does not
 * police placement.
 */

interface Tree {
  members: Map<string, Tree>;
}

function toTree(names: string[]): Tree {
  const root: Tree = { members: new Map() };
  for (const name of names) {
    let cursor = root;
    for (const segment of name.split('.')) {
      if (segment === '$root') continue; // a base-value marker, not a position of its own
      let next = cursor.members.get(segment);
      if (!next) {
        next = { members: new Map() };
        cursor.members.set(segment, next);
      }
      cursor = next;
    }
  }
  return root;
}

/** The one position shape. `sealRoot` is false only for an aspect's own root — see buildSchema. */
function position(tree: Tree, sealed: boolean): object {
  const properties: Record<string, object> = {};
  for (const [name, child] of tree.members) {
    properties[name] = position(child, true);
  }
  return {
    type: 'object',
    properties,
    patternProperties: { '^\\$': true },
    ...(sealed ? { unevaluatedProperties: false } : {}),
  };
}

export function buildSchema(
  names: string[],
  options: { branch?: string },
): object {
  const { branch } = options;
  const selected = branch
    ? names.filter((name) => name.split('.')[0] === branch)
    : names;

  // An aspect must NOT seal the root. Bindings layer — every matching schema validates the same
  // file — so if color.json sealed the root to `color` and space.json to `space`, a file holding
  // both would draw a false error from each. Sealing the root is the wholesale schema's job, and
  // the stated cost is that no aspect refuses an unknown top-level branch.
  const root = position(toTree(selected), !branch) as Record<string, unknown>;

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `vertekum://schema-atlassian/${branch ?? 'atlassian'}.json`,
    title: `Atlassian Design System — ${branch ?? 'all branches'}`,
    description:
      'Token path vocabulary: which names may appear, in what order, and where the order ends. What a granted name IS — group, token, base value — belongs to the token author and the DTCG format schema.',
    ...root,
  };
}
