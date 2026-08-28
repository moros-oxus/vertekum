import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { SchemaGroup, SchemaUse } from '../config/define-config';
import { dialectOf, type SchemaBinding } from '../validate/schema';
import type { Diagnostic } from '../validate/validator';

/**
 * Turn a config's schema groups into bindings ajv can compile.
 *
 * This is the ONLY place that touches the filesystem. `validateFiles` stays pure — it takes schemas
 * as values — so it remains browser-safe and unit-testable, and everything about WHERE a schema
 * lives is settled before it is called.
 */

export interface LoadedSchemas {
  bindings: SchemaBinding[];
  /** Schemas reached through `$ref`, to register with ajv before compiling. */
  referenced: object[];
  diagnostics: Diagnostic[];
}

type Json = Record<string, unknown>;

/** A `$ref` we must resolve ourselves: a path or a bare package specifier, not a JSON pointer or URI. */
function isFileRef(ref: string): boolean {
  return !ref.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(ref);
}

function isRemoteRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

/** Resolve a path-or-specifier against a directory, using Node's own rules for the latter. */
function resolveFrom(spec: string, dir: string): string {
  if (spec.startsWith('.') || isAbsolute(spec)) return resolve(dir, spec);
  // `createRequire` needs a FILE to resolve from; a directory is not one. This path need not exist.
  return createRequire(resolve(dir, 'noop.js')).resolve(spec);
}

function diagnostic(code: string, message: string, file?: string): Diagnostic {
  return {
    code,
    severity: 'error',
    message,
    source: 'core',
    ...(file ? { file } : {}),
  };
}

/**
 * Does this schema constrain anything at all?
 *
 * An OPEN schema lists names without closing them, so binding one accepts every document while
 * looking like enforcement. That must never pass silently — the same reasoning that made a typo'd
 * preset name an error rather than "no constraints".
 *
 * The heuristic errs toward silence: it reports only when it finds NONE of these anywhere, so a
 * schema constraining value formats rather than membership is not flagged.
 */
function constrainsNothing(node: unknown): boolean {
  let found = false;

  const walk = (value: unknown): void => {
    if (found || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const [key, child] of Object.entries(value as Json)) {
      if (
        ((key === 'unevaluatedProperties' || key === 'additionalProperties') &&
          child === false) ||
        key === 'required' ||
        key === 'enum' ||
        key === 'const' ||
        key === 'pattern'
      ) {
        found = true;
        return;
      }
      walk(child);
    }
  };

  walk(node);
  return !found;
}

/**
 * Load one schema file and every file it references, rewriting file `$ref`s to the target's `$id`.
 *
 * ajv cannot resolve `@scope/pkg/x.json`, so this rewrite is what makes cross-file composition work
 * at all: each referenced file is registered by `$id`, and the ref becomes that `$id`. A file with
 * no `$id` gets one synthesised from its absolute path, so composing an anonymous schema needs no
 * ceremony from its author.
 */
/** Every `$id` declared anywhere in a document — the refs these satisfy resolve without fetching. */
function collectIds(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectIds(item, into);
    return;
  }
  const record = node as Json;
  if (typeof record.$id === 'string') into.add(record.$id);
  for (const value of Object.values(record)) collectIds(value, into);
}

async function loadFile(
  path: string,
  cache: Map<string, Json>,
  referenced: object[],
  diagnostics: Diagnostic[],
  seen: Set<string>,
  knownIds: Set<string>,
): Promise<Json | undefined> {
  const hit = cache.get(path);
  if (hit) return hit;
  if (seen.has(path)) return undefined; // reference cycle — the first load wins
  seen.add(path);

  let parsed: Json;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8')) as Json;
  } catch (error) {
    diagnostics.push(
      diagnostic(
        'schema/unreadable',
        `cannot read schema '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
    return undefined;
  }

  if (typeof parsed.$id !== 'string') parsed.$id = `vertekum:file/${path}`;
  cache.set(path, parsed);
  collectIds(parsed, knownIds);

  const dir = dirname(path);

  const walk = async (node: unknown): Promise<void> => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) await walk(item);
      return;
    }

    const object = node as Json;
    const ref = object.$ref;
    if (typeof ref === 'string') {
      if (ref.startsWith('dtcg#')) {
        // A derived anchor of the effective DTCG schema (`dtcg#typographyValue`, …) — resolved by
        // binding assembly against the anchor shell, never by this loader. Left verbatim.
      } else if (isRemoteRef(ref)) {
        // Remote-LOOKING is not remote: the published DTCG schema references its own inlined,
        // $id-carrying definitions by absolute URL, and a validator resolves those with no
        // network. Only a ref that nothing loaded can satisfy would need a fetch — that one is
        // refused, because offline and CI must behave identically.
        const target = ref.split('#')[0] as string;
        if (!knownIds.has(target)) {
          diagnostics.push(
            diagnostic(
              'schema/remote-ref',
              `'${path}' references '${ref}'. Remote schemas are never fetched — vendor it as a file whose $id is that URL.`,
              path,
            ),
          );
        }
      } else if (isFileRef(ref)) {
        // A ref may name a SUBSCHEMA of another file — `../base.json#/properties/color`. Extending
        // a schema requires exactly that: closing a nested level means re-referencing the base at
        // that level, so the fragment has to survive the rewrite.
        const hash = ref.indexOf('#');
        const spec = hash === -1 ? ref : ref.slice(0, hash);
        const fragment = hash === -1 ? '' : ref.slice(hash);

        let target: string | undefined;
        try {
          target = resolveFrom(spec, dir);
        } catch {
          diagnostics.push(
            diagnostic(
              'schema/unreadable',
              `'${path}' references '${ref}', which does not resolve to a file`,
              path,
            ),
          );
        }
        if (target) {
          const loaded = await loadFile(
            target,
            cache,
            referenced,
            diagnostics,
            seen,
            knownIds,
          );
          if (loaded) {
            object.$ref = `${loaded.$id as string}${fragment}`;
            if (!referenced.includes(loaded)) referenced.push(loaded);
          }
        }
      }
    }

    for (const [key, child] of Object.entries(object)) {
      if (key === '$ref') continue;
      await walk(child);
    }
  };
  await walk(parsed);

  return parsed;
}

/** Keys of these maps are NAMES, not keywords — the walk must not read them as keywords. */
const NAME_MAPS = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
]);
const POST_DRAFT7 = new Set([
  'unevaluatedProperties',
  'unevaluatedItems',
  'prefixItems',
  'dependentSchemas',
  'dependentRequired',
  '$dynamicRef',
  '$dynamicAnchor',
]);
const POST_2019 = new Set(['prefixItems', '$dynamicRef', '$dynamicAnchor']);

/**
 * Keywords a schema uses that its DECLARED dialect does not define.
 *
 * A validator silently ignores unknown keywords, so such a schema enforces LESS than it reads —
 * a draft-07 file carrying `unevaluatedProperties` looks sealed and seals nothing. The no-op guard
 * cannot see it (the keyword is present), so the mismatch gets its own diagnostic.
 */
function foreignKeywords(schema: Json): string[] {
  const foreign =
    dialectOf(schema) === 'draft-07'
      ? POST_DRAFT7
      : dialectOf(schema) === '2019-09'
        ? POST_2019
        : undefined;
  if (!foreign) return [];

  const found = new Set<string>();
  const walk = (node: unknown, underNameMap: boolean): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, false);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (!underNameMap && foreign.has(key)) found.add(key);
      walk(value, !underNameMap && NAME_MAPS.has(key));
    }
  };
  walk(schema, false);
  return [...found];
}

function normalize(use: SchemaUse): Exclude<SchemaUse, string> {
  return typeof use === 'string' ? { match: use } : use;
}

export async function loadSchemas(
  groups: SchemaGroup[],
  options: { dir: string; builtins?: SchemaBinding[] },
): Promise<LoadedSchemas> {
  const diagnostics: Diagnostic[] = [];
  const referenced: object[] = [];
  const cache = new Map<string, Json>();
  const knownIds = new Set<string>();
  const configured: SchemaBinding[] = [];

  for (const group of groups) {
    for (const [name, use] of Object.entries(group.use)) {
      const entry = normalize(use);

      let path: string;
      try {
        path = resolveFrom(`${group.from}/${name}`, options.dir);
      } catch (error) {
        diagnostics.push(
          diagnostic(
            'schema/unreadable',
            `cannot resolve '${name}' from '${group.from}': ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
        continue;
      }

      const schema = await loadFile(
        path,
        cache,
        referenced,
        diagnostics,
        new Set(),
        knownIds,
      );
      if (!schema) continue;

      // A patch document (top-level `$extends`) constrains nothing BY DESIGN — it is merged into
      // the effective DTCG schema at assembly, so the no-op and dialect guards do not apply.
      const patch =
        typeof schema === 'object' && schema !== null && '$extends' in schema;

      const foreign = patch ? [] : foreignKeywords(schema);
      if (foreign.length > 0) {
        diagnostics.push(
          diagnostic(
            'schema/dialect-mismatch',
            `'${group.from}/${name}' declares ${dialectOf(schema)} but uses ${foreign.join(
              ', ',
            )} — the dialect ignores ${
              foreign.length > 1 ? 'them' : 'it'
            }, so the schema enforces less than it reads. Declare 2020-12, or rewrite for the declared dialect.`,
            path,
          ),
        );
      }

      if (!patch && constrainsNothing(schema)) {
        diagnostics.push(
          diagnostic(
            'schema/no-op',
            `'${group.from}/${name}' constrains nothing — an open schema lists names without closing them. Did you mean closed/?`,
            path,
          ),
        );
      }

      const severity = entry.severity ?? group.severity;
      const domain = entry.domain ?? group.domain;
      configured.push({
        match: entry.match,
        target: entry.target ?? group.target ?? 'tokens',
        schema,
        file: path,
        origin: 'config',
        ...(severity ? { severity } : {}),
        ...(domain ? { domain } : {}),
        ...(entry.id ? { id: entry.id } : {}),
      });
    }
  }

  // A configured entry REPLACES a built-in of the same id. Layering a second copy would report the
  // same violation twice, and there would be no way to loosen a rule core ships.
  const replaced = new Set(
    configured.map((binding) => binding.id).filter(Boolean),
  );
  const builtins = (options.builtins ?? []).filter(
    (binding) => !binding.id || !replaced.has(binding.id),
  );

  return { bindings: [...builtins, ...configured], referenced, diagnostics };
}
