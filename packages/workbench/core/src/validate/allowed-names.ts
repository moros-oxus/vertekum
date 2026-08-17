type Node = Record<string, unknown>;

/** A node together with the document it came from — local `$ref`s resolve against THAT document. */
interface Located {
  node: Node;
  doc: unknown;
}

/** Follow a JSON Pointer (`/a/b`) into a document. */
function pointer(root: unknown, path: string): Node | undefined {
  let cursor = root as Node | undefined;
  for (const segment of path.split('/').filter(Boolean)) {
    cursor = cursor?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')] as
      | Node
      | undefined;
    if (!cursor) return undefined;
  }
  return cursor;
}

/**
 * Resolve a `$ref`: a local pointer against its OWN document, a cross-file one against the registry.
 *
 * Carrying the document is the trick. Following a ref into a packaged schema and then resolving
 * that schema's internal `#/$defs/...` against the *referring* document silently finds nothing,
 * which reads as "the base contributes no names" and yields a confidently short list.
 */
function deref(
  located: Located,
  registry: readonly object[],
): Located | undefined {
  const ref = located.node.$ref;
  if (typeof ref !== 'string') return located;

  if (ref.startsWith('#')) {
    const node = pointer(located.doc, ref.slice(1));
    return node ? { node, doc: located.doc } : undefined;
  }

  const hash = ref.indexOf('#');
  const id = hash === -1 ? ref : ref.slice(0, hash);
  const fragment = hash === -1 ? '' : ref.slice(hash + 1);
  const target = registry.find((entry) => (entry as Node).$id === id);
  if (!target) return undefined;

  const node = fragment ? pointer(target, fragment) : (target as Node);
  // The document becomes the TARGET, so its own local refs resolve where they were written.
  return node ? { node, doc: target } : undefined;
}

/**
 * Every schema that applies to one instance location: the node itself, plus whatever its `$ref` and
 * `allOf` bring in, recursively.
 *
 * A LIST rather than a merged object, because several schemas genuinely apply at once — an
 * extending schema and the base it composes both describe `/color/text`, and collapsing them would
 * silently pick one. That is exactly how the extension's own added names went missing.
 *
 * Returns `undefined` when any `$ref` on the path is unreachable: a partly-known vocabulary must
 * not be reported as if it were complete.
 */
function applying(
  located: Located,
  registry: readonly object[],
  depth = 0,
): Located[] | undefined {
  if (depth > 8) return undefined;

  const resolved = deref(located, registry);
  if (!resolved) return undefined;

  const out: Located[] = [resolved];
  if (Array.isArray(resolved.node.allOf)) {
    for (const entry of resolved.node.allOf as Node[]) {
      const part = applying(
        { node: entry, doc: resolved.doc },
        registry,
        depth + 1,
      );
      if (!part) return undefined;
      out.push(...part);
    }
  }
  return out;
}

/** The union of `properties` across every schema applying here, each name keeping its document. */
function propertiesOf(
  locateds: Located[],
): Record<string, Located[]> | undefined {
  const out: Record<string, Located[]> = {};
  for (const located of locateds) {
    const own = located.node.properties as Node | undefined;
    if (!own) continue;
    for (const [name, child] of Object.entries(own)) {
      const entries = out[name] ?? [];
      entries.push({ node: child as Node, doc: located.doc });
      out[name] = entries;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The property names a schema permits at a JSON Pointer location.
 *
 * A closed-membership failure is only useful if it says what WAS allowed. ajv reports
 * `additionalProperties`/`unevaluatedProperties` as "must NOT have …", which is true and nearly
 * useless to an author who needs to know the vocabulary. This walks the bound schema along the
 * failure's `instancePath`, following `allOf` and `$ref` — including cross-file refs, resolved
 * against `registry`, which is how an EXTENDING schema reports the base's names alongside its own.
 *
 * Returns `undefined` when the schema is not walkable — an unreachable `$ref`, `patternProperties`,
 * or anything else indirect. Degrading to a message without the list is correct: a partly-helpful
 * message beats a confidently wrong one.
 */
export function allowedNamesAt(
  schema: unknown,
  instancePath: string,
  registry: readonly object[] = [],
): string[] | undefined {
  /** Everything applying at this location, or `undefined` if any ref on the way is unreachable. */
  const expand = (locateds: Located[]): Located[] | undefined => {
    const out: Located[] = [];
    for (const located of locateds) {
      const part = applying(located, registry);
      if (!part) return undefined;
      out.push(...part);
    }
    return out;
  };

  let current: Located[] = [{ node: schema as Node, doc: schema }];

  for (const segment of instancePath.split('/').filter(Boolean)) {
    const expanded = expand(current);
    if (!expanded) return undefined;

    const properties = propertiesOf(expanded);
    // JSON Pointer escapes: `~1` is `/` and `~0` is `~`, in that order.
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!properties?.[key]) return undefined;
    current = properties[key];
  }

  const expanded = expand(current);
  if (!expanded) return undefined;

  const properties = propertiesOf(expanded);
  return properties ? Object.keys(properties) : undefined;
}
