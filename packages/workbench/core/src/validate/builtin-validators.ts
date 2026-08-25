import type { Token } from '../document/types';
import { ROOT_TOKEN } from '../dtcg/parse';
import { isPointerObject, parsePointer } from '../dtcg/pointer';
import {
  indexByPath,
  isReference,
  referenceToPath,
  resolveValue,
} from '../dtcg/references';
import { referencedSetRefs, validateResolver } from '../dtcg/resolve';
import { resolveExporterInput } from '../export/resolve-input';
import { targetId } from '../export/target';
import type { Diagnostic, Validator } from './validator';
import { valueMatchesType } from './value-type';

/**
 * The validators DTCG itself mandates — always on, no install.
 *
 * Reference validity (§7.2.3: references MUST NOT be circular; §7.4.5: tools report unresolvable
 * paths and cycles) and resolver semantics are spec behaviour, not optional capability, so they
 * run from core exactly like the built-in format binding: whether a broken reference is reported
 * must not depend on which extensions a project happens to install. The ADR-0030 registry remains
 * the seam for ADDITIONAL validators.
 */

/** Report references that do not resolve within one already-resolved bundle. */
function check(
  tokens: Token[],
  label: string,
  composition: string,
): Diagnostic[] {
  const byPath = indexByPath(tokens);
  const out: Diagnostic[] = [];
  for (const token of tokens) {
    if (!isReference(token.value)) continue;
    if (resolveValue(token, byPath) !== undefined) continue;
    const path = referenceToPath(token.value);
    // The target exists but still failed to resolve ⇒ the chain cycles back on itself.
    const cyclic = byPath.has(path);
    out.push({
      code: cyclic ? 'token/cyclic-alias' : 'token/dangling-alias',
      severity: 'error',
      message: cyclic
        ? `'${token.path.join('.')}' is part of a reference cycle through '${path}' (${label})`
        : `'${token.path.join('.')}' references '${path}', which does not exist (${label})`,
      source: 'core',
      file: `${token.set}.json`,
      target: { kind: 'set', name: composition },
    });
  }
  return out;
}

/** The dotted token path a name-space (token-node) `$ref` denotes, or null for any other pointer. */
function refTargetPath(ref: string): string | null {
  const segments = parsePointer(ref);
  if (!segments) return null;
  if (!segments.every((s) => !s.startsWith('$') || s === ROOT_TOKEN)) {
    return null;
  }
  return segments.join('.');
}

/** The target another token denotes, by either notation; null for fragments and literals. */
function referenceTarget(
  token: Token,
  byPath: Map<string, Token>,
): Token | null {
  if (isReference(token.value)) {
    return byPath.get(referenceToPath(token.value)) ?? null;
  }
  if (token.ref !== undefined) {
    const path = refTargetPath(token.ref);
    return path === null ? null : (byPath.get(path) ?? null);
  }
  return null;
}

/**
 * §5.2.2: a reference's type is the RESOLVED type of what it references — the first non-empty
 * type along the chain (both notations), cycle-guarded. '' when the chain never yields one.
 */
function resolvedTypeOf(token: Token, byPath: Map<string, Token>): string {
  let node: Token | null = token;
  const seen = new Set<string>();
  while (node) {
    if (node.type !== '') return node.type;
    if (seen.has(node.id)) return '';
    seen.add(node.id);
    node = referenceTarget(node, byPath);
  }
  return '';
}

/**
 * §7.4.5 type mismatches: a token that DECLARES a type must agree with what its reference brings —
 * §5.2.2 makes inheritance the rule when nothing is declared, so `''` never reports.
 *
 * Two halves, split by what the reference denotes. WHOLE-TOKEN references (curly aliases,
 * name-space `$ref`s) compare declared type against the target's resolved type. VALUE-LEVEL
 * references (property-space pointers, value-position `{"$ref"}` objects) have no target type to
 * compare — §7.3 legitimately extracts a number from a colour — so the MATERIALIZED value is
 * judged by the declared type's published value schema. Literals are never checked here (the
 * format binding owns files), nor are values still carrying dangling markers (already reported).
 */
async function checkTypes(
  tokens: Token[],
  label: string,
  composition: string,
): Promise<Diagnostic[]> {
  const byPath = indexByPath(tokens);
  const out: Diagnostic[] = [];
  const diagnostic = (token: Token, message: string): Diagnostic => ({
    code: 'token/type-mismatch',
    severity: 'error',
    message,
    source: 'core',
    file: `${token.set}.json`,
    target: { kind: 'set', name: composition },
  });

  for (const token of tokens) {
    if (token.type === '') continue;

    const target = referenceTarget(token, byPath);
    if (target) {
      const resolved = resolvedTypeOf(target, byPath);
      if (resolved !== '' && resolved !== token.type) {
        out.push(
          diagnostic(
            token,
            `'${token.path.join('.')}' declares type '${token.type}' but references '${target.path.join('.')}', which resolves to '${resolved}' (${label})`,
          ),
        );
      }
      continue;
    }

    const valueLevel =
      (token.ref !== undefined && refTargetPath(token.ref) === null) ||
      token.sourceValue !== undefined;
    if (!valueLevel || token.value === undefined) continue;
    if (survivingPointers(token.value).length > 0) continue;
    const conforms = await valueMatchesType(token.type, token.value);
    if (conforms === false) {
      out.push(
        diagnostic(
          token,
          `'${token.path.join('.')}' declares type '${token.type}' but its reference materializes a value that is not a ${token.type} (${label})`,
        ),
      );
    }
  }
  return out;
}

/** Collect the `$ref` strings of pointer objects that survived materialization — each is a miss. */
function survivingPointers(value: unknown, out: string[] = []): string[] {
  if (isPointerObject(value)) {
    out.push(value.$ref);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) survivingPointers(v, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) survivingPointers(v, out);
  }
  return out;
}

/**
 * Report JSON Pointer references that failed to materialize in one composed bundle. A `#/` pointer
 * addresses the FLATTENED document (resolver spec), so — exactly like aliases — whether it resolves
 * depends on the composition: a target living only in `light.json` resolves under light and dangles
 * under dark. Bundles arrive already materialized (`resolveExporterInput`; the flat model at parse),
 * so this reads the outcome rather than re-deriving it.
 */
function checkPointers(
  tokens: Token[],
  label: string,
  composition: string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const token of tokens) {
    const name = token.path.join('.');
    const file = `${token.set}.json`;
    const base = {
      severity: 'error' as const,
      source: 'core',
      file,
      target: { kind: 'set' as const, name: composition },
    };
    if (token.refIssue !== undefined) {
      out.push({
        ...base,
        code:
          token.refIssue === 'cycle'
            ? 'token/cyclic-pointer'
            : 'token/dangling-pointer',
        message:
          token.refIssue === 'cycle'
            ? `'${name}' is part of a pointer cycle through '${token.ref}' (${label})`
            : `'${name}' points at '${token.ref}', which does not resolve (${label})`,
      });
      continue;
    }
    for (const ref of survivingPointers(token.value)) {
      out.push({
        ...base,
        code: 'token/dangling-pointer',
        message: `'${name}' contains pointer '${ref}', which does not resolve (${label})`,
      });
    }
  }
  return out;
}

/**
 * Dangling and cyclic references — curly aliases AND JSON Pointers (ADR-0030 vocabulary). Whether
 * a reference resolves depends on the composition, so every composition's base AND each variant is
 * checked, using the same resolved bundle the exporters consume. Without this, a typo'd alias
 * silently produces CSS referencing a custom property that was never defined.
 */
export const aliasValidator: Validator = {
  id: 'core.references',
  name: 'Token references',
  async validate({ tokens, resolvers }) {
    if (resolvers.size === 0) {
      // The flat model materialized against the merged collection at parse — read it directly.
      return [
        ...checkPointers(tokens, 'flat', 'flat'),
        ...check(tokens, 'flat', 'flat'),
        ...(await checkTypes(tokens, 'flat', 'flat')),
      ];
    }
    const seen = new Set<string>();
    const out: Diagnostic[] = [];
    for (const [name, resolver] of resolvers) {
      const input = resolveExporterInput(resolver, tokens);
      const bundles = [
        { label: `${name}, base`, list: input.base },
        ...input.variants.map((v) => ({
          label: `${name}, ${v.modifier}=${v.context}`,
          list: v.tokens,
        })),
      ];
      for (const { label, list } of bundles) {
        const found = [
          ...checkPointers(list, label, name),
          ...check(list, label, name),
          ...(await checkTypes(list, label, name)),
        ];
        for (const diagnostic of found) {
          const key = `${diagnostic.code}:${diagnostic.message}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(diagnostic);
        }
      }
    }
    return out;
  },
};

/**
 * Semantic resolver validity, namespaced under `resolver/` — the issue vocabulary the resolver arc
 * designed IS the public contract. `unknown-source` is skipped: it is structural, reported
 * unconditionally by `check` itself; reporting it here would print it twice.
 */
export const resolverValidator: Validator = {
  id: 'core.resolvers',
  name: 'Composition validity',
  validate({ resolvers, sets }) {
    // `validateResolver` compares against known source REFS (file names), not set names.
    const knownRefs = new Set(sets.map((set) => `${set}.json`));
    const diagnostics: Diagnostic[] = [];
    for (const [name, doc] of resolvers) {
      for (const issue of validateResolver(doc, knownRefs)) {
        if (issue.code === 'unknown-source') continue;
        diagnostics.push({
          code: `resolver/${issue.code}`,
          severity: issue.severity,
          message: issue.message,
          source: 'core',
          file: `${name}.resolver.json`,
          target: issue.target,
        });
      }
    }

    // The inverse of `unknown-source`: a set file no composition mentions. Its tokens are
    // validated, then reach no output — the silent half of a wiring mistake, so it warns rather
    // than errors (an author mid-flight legitimately has the set before its composition entry).
    // A collection-level finding, so it lands on the set file, not on any one resolver — and only
    // when resolvers exist at all: the flat model merges every file, orphaning nothing.
    if (resolvers.size > 0) {
      const referenced = new Set<string>();
      for (const doc of resolvers.values()) {
        for (const ref of referencedSetRefs(doc)) referenced.add(ref);
      }
      for (const set of sets) {
        const file = `${set}.json`;
        if (referenced.has(file)) continue;
        diagnostics.push({
          code: 'resolver/unreferenced-set',
          severity: 'warning',
          message: `'${file}' is referenced by no composition — its tokens reach no output`,
          source: 'core',
          file,
        });
      }
    }
    return diagnostics;
  },
};

/**
 * Configured targets against the live registry and each exporter's own options schema (ADR-0030)
 * — what lets an agent configure a third-party exporter it has never seen and be told precisely
 * what it got wrong. No-ops when the runner supplied no targets.
 */
export const targetValidator: Validator = {
  id: 'core.targets',
  name: 'Export targets',
  validate({ resolvers, targets, exporters }) {
    const out: Diagnostic[] = [];
    const seen = new Set<string>();
    for (const target of targets ?? []) {
      const id = targetId(target);
      if (seen.has(id)) {
        out.push({
          code: 'export/duplicate-target-id',
          severity: 'error',
          message: `two targets share the id '${id}'`,
          source: 'core',
        });
      }
      seen.add(id);

      const exporter = exporters?.get(target.exporter);
      if (!exporter) {
        out.push({
          code: 'export/unknown-exporter',
          severity: 'error',
          message: `target '${id}' names exporter '${target.exporter}', which is not registered`,
          source: 'core',
        });
        continue;
      }
      if (
        target.composition !== undefined &&
        !resolvers.has(target.composition)
      ) {
        out.push({
          code: 'export/unknown-composition',
          severity: 'error',
          message: `target '${id}' names composition '${target.composition}', which does not exist`,
          source: 'core',
        });
      }
      const parsed = exporter.optionsSchema?.safeParse(target.options ?? {});
      if (parsed && !parsed.success) {
        for (const issue of parsed.error.issues) {
          out.push({
            code: 'export/invalid-options',
            severity: 'error',
            message: `target '${id}' options.${issue.path.join('.') || '(root)'}: ${issue.message}`,
            source: 'core',
          });
        }
      }
    }
    return out;
  },
};

/** The always-on set `vertekum check` runs before any registry-supplied validators. */
export const builtinValidators: Validator[] = [
  aliasValidator,
  resolverValidator,
  targetValidator,
];
