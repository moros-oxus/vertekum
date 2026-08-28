import type { Diagnostic } from './validator';

/**
 * Extending the DTCG schema (designed in dialogue, 2026-08-28).
 *
 * Custom and compound types are a SCHEMA concern: the author declares what the project's
 * effective DTCG schema allows — new `$type`s, new members on compound values — and tokens store
 * `$type`/`$value` directly. Two mechanisms make the declaration small:
 *
 * - **Derived anchors**: short names (`dtcg#tokenType`, `dtcg#typographyValue`,
 *   `dtcg#curlyBraceReference`) derived from the EFFECTIVE `dtcg-tokens` schema — bundled or
 *   ejected — so authors never type a spec URL and ejection feeds the anchors.
 * - **Patch documents**: a schema document whose top level is `$extends`, mapping targets to
 *   deltas, merged into the effective schema at load. The merge is structural because the spec's
 *   value schemas are CLOSED (draft-07 `additionalProperties: false`) and composition cannot open
 *   them.
 *
 * Merge semantics — extend to add, layer to restrict: layered bindings already intersect, so
 * narrowing is layering's job. `$extends` is purely additive: objects deep-merge, `enum` and
 * `required` UNION, `allOf`/`anyOf`/`oneOf` APPEND, other arrays and scalars replace.
 */

type Json = Record<string, unknown>;

/** The anchor id every derived name registers under: `{ "$ref": "dtcg#typographyValue" }`. */
export const DTCG_ANCHOR_ID = 'dtcg';

const FORMAT_URL = /\/format\/(?:values\/)?([A-Za-z]+)\.json$/;
const VALUES_URL = /\/format\/values\/[A-Za-z]+\.json$/;

/** The anchor name for one `definitions` key: plain keys as-is, spec URLs by their basename. */
function anchorName(key: string): string | null {
  if (!key.includes('://')) return key;
  const match = FORMAT_URL.exec(key);
  if (!match) return null;
  const base = match[1] as string;
  return VALUES_URL.test(key) ? `${base}Value` : base;
}

/** Derived anchors of an effective DTCG schema: name → the LIVE definition node (not a copy). */
export function anchorsOf(schema: object): Map<string, Json> {
  const out = new Map<string, Json>();
  const definitions = (schema as Json).definitions;
  if (!definitions || typeof definitions !== 'object') return out;
  for (const [key, node] of Object.entries(definitions as Json)) {
    const name = anchorName(key);
    if (name && node && typeof node === 'object') out.set(name, node as Json);
  }
  return out;
}

/** `~`/`/` escaping for a JSON Pointer segment (spec URLs contain slashes). */
function escapeSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * The anchor SHELL: a self-contained schema registered under `$id: "dtcg"` in every validator
 * dialect, so any binding's schema can `$ref: "dtcg#<name>"`. It carries a full copy of the
 * effective schema's `definitions` — the spec's definitions reference each other by local
 * pointer and absolute `$id`, and both resolve inside the copy — plus thin `$anchor` entries
 * pointing at them. (`$anchor` is a 2020-12 construct: anchors resolve from 2020-12 schemas,
 * which is the default authoring dialect.)
 */
export function anchorShell(schema: object): object {
  const definitions = structuredClone(
    ((schema as Json).definitions ?? {}) as Json,
  );
  const defs: Json = {};
  for (const key of Object.keys(definitions)) {
    const name = anchorName(key);
    if (!name) continue;
    defs[name] = {
      $anchor: name,
      $ref: `#/definitions/${escapeSegment(key)}`,
    };
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: DTCG_ANCHOR_ID,
    definitions,
    $defs: defs,
  };
}

/** Keys allowed beside `$extends` in a patch document — annotations, never constraints. */
const PATCH_ANNOTATIONS = new Set([
  '$extends',
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
]);

/** A patch document: top-level `$extends` (targets → deltas), nothing structural beside it. */
export function isPatchDocument(schema: object): boolean {
  return '$extends' in schema;
}

/** Keys of `enum`-like arrays that UNION under merge; applicator arrays APPEND; the rest replace. */
const UNION_KEYS = new Set(['enum', 'required']);
const APPEND_KEYS = new Set(['allOf', 'anyOf', 'oneOf']);

function mergeValue(key: string, base: unknown, delta: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(delta)) {
    if (UNION_KEYS.has(key)) {
      const seen = new Set(base.map((v) => JSON.stringify(v)));
      return [...base, ...delta.filter((v) => !seen.has(JSON.stringify(v)))];
    }
    if (APPEND_KEYS.has(key)) return [...base, ...structuredClone(delta)];
    return structuredClone(delta);
  }
  if (
    base &&
    delta &&
    typeof base === 'object' &&
    typeof delta === 'object' &&
    !Array.isArray(base) &&
    !Array.isArray(delta)
  ) {
    deepMerge(base as Json, delta as Json);
    return base;
  }
  return structuredClone(delta);
}

function deepMerge(base: Json, delta: Json): void {
  for (const [key, value] of Object.entries(delta)) {
    base[key] =
      key in base ? mergeValue(key, base[key], value) : structuredClone(value);
  }
}

export interface SchemaPatch {
  /** The patch document (top-level `$extends`). */
  document: object;
  /** For diagnostics: where this patch came from (file path or extension origin). */
  label: string;
}

/**
 * Each anchor's CANONICAL address inside the effective schema — a URL-keyed definition's own
 * `$id`, a plain key's root-`$id` pointer. `dtcg#…` refs inside a DELTA are rewritten to these
 * before merging: the merged content lands inside a draft-07 document where `$anchor` does not
 * exist (and where subschema `$id`s shift the base URI), so only absolute addresses survive.
 * The `dtcg#` spelling stays valid unrewritten in standalone 2020-12 schemas, which resolve it
 * through the anchor shell.
 */
function anchorAddresses(schema: object): Map<string, string> {
  const rootId = (schema as Json).$id;
  const out = new Map<string, string>();
  const definitions = (schema as Json).definitions;
  if (!definitions || typeof definitions !== 'object') return out;
  for (const key of Object.keys(definitions as Json)) {
    const name = anchorName(key);
    if (!name) continue;
    out.set(
      name,
      key.includes('://')
        ? key
        : `${typeof rootId === 'string' ? rootId : ''}#/definitions/${escapeSegment(key)}`,
    );
  }
  return out;
}

/** Rewrite every `$ref: "dtcg#name"` in a delta to its canonical address; unknown names throw. */
function rewriteRefs(node: unknown, addresses: Map<string, string>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) rewriteRefs(item, addresses);
    return;
  }
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === '$ref' && typeof value === 'string') {
      const name = /^dtcg#(.+)$/.exec(value)?.[1];
      if (name !== undefined) {
        const address = addresses.get(name);
        if (!address) throw new Error(value);
        (node as Json).$ref = address;
      }
      continue;
    }
    rewriteRefs(value, addresses);
  }
}

/**
 * Apply patch documents to a MUTABLE clone of the effective DTCG schema, in order. Targets are
 * `dtcg#<anchor>`; an unknown target or a malformed document is a diagnostic, never a silent
 * no-op. Anchors are looked up once — merges mutate definition nodes in place, so later patches
 * see earlier ones.
 */
export function applyPatches(
  effective: object,
  patches: SchemaPatch[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const anchors = anchorsOf(effective);
  const addresses = anchorAddresses(effective);
  const refuse = (label: string, message: string): void => {
    diagnostics.push({
      code: 'schema/unknown-extend-target',
      severity: 'error',
      message,
      source: 'core',
      file: label,
    });
  };

  for (const patch of patches) {
    const doc = patch.document as Json;
    const extra = Object.keys(doc).filter((k) => !PATCH_ANNOTATIONS.has(k));
    if (extra.length > 0) {
      refuse(
        patch.label,
        `a patch document holds only $extends and annotations — remove: ${extra.join(', ')}`,
      );
      continue;
    }
    const map = doc.$extends;
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      refuse(
        patch.label,
        '$extends maps targets to deltas, e.g. {"dtcg#tokenType": {…}}',
      );
      continue;
    }
    for (const [target, delta] of Object.entries(map as Json)) {
      const name = /^dtcg#(.+)$/.exec(target)?.[1];
      const node = name === undefined ? undefined : anchors.get(name);
      if (!node) {
        refuse(
          patch.label,
          `unknown $extends target '${target}' — anchors of the effective DTCG schema: ${[...anchors.keys()].join(', ')}`,
        );
        continue;
      }
      if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
        refuse(
          patch.label,
          `the delta for '${target}' must be a schema object`,
        );
        continue;
      }
      const rewritten = structuredClone(delta) as Json;
      try {
        rewriteRefs(rewritten, addresses);
      } catch (error) {
        refuse(
          patch.label,
          `unknown $ref '${error instanceof Error ? error.message : error}' in the delta for '${target}'`,
        );
        continue;
      }
      deepMerge(node, rewritten);
    }
  }
  return diagnostics;
}
