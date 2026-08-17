import { isResolverFile } from '../document/files';
import { allowedNamesAt } from './allowed-names';
import { DTCG_RESOLVER_SCHEMA, DTCG_TOKEN_SCHEMA } from './dtcg-schema';
import type { Diagnostic } from './validator';

/**
 * One schema applied to the files it matches. Bindings are **config**, not code: the default set
 * below is what a project gets with no configuration, and a consumer adds entries to validate
 * particular paths against their own (or a third party's) schema.
 */
export interface SchemaBinding {
  /** Glob over the file name, e.g. `core.json` or `*`. */
  match: string;
  /**
   * Which kind of file this applies to; token sets by default.
   *
   * This replaced first-match-wins. Bindings now LAYER — a house vocabulary and DTCG
   * well-formedness both apply to the same file — so the DTCG token schema needs an explicit way to
   * stay off resolver files rather than relying on being listed second.
   */
  target?: 'tokens' | 'resolver';
  /** A JSON Schema document (https://json-schema.org/). */
  schema: object;
  /** Default `'error'`. A binding whose schema is advisory can warn instead. */
  severity?: 'error' | 'warning';
  /** Diagnostic code prefix; default `'schema'`. */
  domain?: string;
  /**
   * Replaces a built-in binding of the same id rather than layering beside it — how a project
   * ejects a schema core ships and binds its own copy back. Set from config; built-ins carry theirs.
   */
  id?: string;
  /** Absolute path this schema was loaded from, when it came from a file. Published by `describe`. */
  file?: string;
}

/**
 * The JSON Schema dialect a schema declares; absent means 2020-12, the historical default here.
 *
 * Exported for the loader's dialect-mismatch guard — the two layers must agree on what a schema's
 * declaration means, or the guard would warn about a dialect the validator never uses.
 */
export function dialectOf(schema: object): 'draft-07' | '2019-09' | '2020-12' {
  const declared = (schema as { $schema?: string }).$schema ?? '';
  if (declared.includes('draft-07')) return 'draft-07';
  if (declared.includes('2019-09')) return '2019-09';
  return '2020-12';
}

/**
 * The DTCG well-formedness bindings every project gets. A configured vocabulary layers ON TOP of
 * these rather than replacing them: being well-formed DTCG and using permitted names are different
 * questions, and an author should be told which one they got wrong.
 */
export function defaultBindings(): SchemaBinding[] {
  return [
    // No `domain`: DTCG failures keep the established `schema/*` codes. A configured vocabulary
    // carries its own domain, which is what distinguishes the two in a report.
    //
    // The `id`s are what let a project eject either file and bind its own copy back in its place —
    // a moving spec should be a file swap, not a wait for a Vertekum release.
    {
      id: 'dtcg-resolver',
      match: '*',
      target: 'resolver',
      schema: DTCG_RESOLVER_SCHEMA,
    },
    {
      id: 'dtcg-tokens',
      match: '*',
      target: 'tokens',
      schema: DTCG_TOKEN_SCHEMA,
    },
  ];
}

/** Compile a glob (`*` = any run of characters) to an anchored regex. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** ajv's error shape, narrowed to what a diagnostic needs. */
interface SchemaError {
  instancePath: string;
  keyword: string;
  message?: string;
  params?: Record<string, unknown>;
}

/**
 * Turn one schema error into the vocabulary `check` already speaks. `instancePath` is a JSON
 * Pointer (`/color/base/$description`), which locates the problem precisely without the parser
 * needing to track source positions — and is more directly actionable for an agent than a line and
 * column, because it names the thing rather than where it happens to sit in the file.
 */
/**
 * The offending key, whichever closure keyword reported it. `additionalProperties` reports
 * `additionalProperty`; 2020-12's composition-aware `unevaluatedProperties` reports
 * `unevaluatedProperty`. A schema may use either, so both have to be understood.
 */
function offendingKey(error: SchemaError): string | undefined {
  const params = error.params ?? {};
  const key = params.additionalProperty ?? params.unevaluatedProperty;
  return typeof key === 'string' ? key : undefined;
}

function describeFailure(
  error: SchemaError,
  binding: SchemaBinding,
  registry: readonly object[],
): string {
  const offender = offendingKey(error);
  if (!offender) {
    return error.message ?? 'is invalid';
  }

  // A closed schema's whole value is telling an author WHY they are stopped, so name the offender
  // and the vocabulary it was measured against instead of ajv's "must NOT have additional
  // properties".
  // The registry is what lets an EXTENDING schema still report the base's names: without it the
  // list would hold only the names the extension itself adds, which reads as "these are the only
  // permitted names" and is flatly wrong.
  const names =
    allowedNamesAt(binding.schema, error.instancePath, registry) ?? [];
  // A schema's `properties` mixes DTCG's structural `$` keys with the vocabulary's member names.
  // Show whichever kind was mistyped: a bad `$vaule` wants the DTCG keys, a bad `bland` wants the
  // member names, and listing both buries the answer in noise.
  const structural = offender.startsWith('$');
  const allowed = names.filter((name) => name.startsWith('$') === structural);
  return allowed.length > 0
    ? `'${offender}' is not permitted — allowed: ${allowed.join(', ')}`
    : `'${offender}' is not permitted here`;
}

/** Applicator envelopes (`oneOf` failed, `if` matched the else…) locate nothing an author can act on. */
const ENVELOPES = new Set(['oneOf', 'anyOf', 'allOf', 'if', 'not']);
/** When several branch errors land on one node, the author needs the sharpest lens, once. */
const KEYWORD_PRIORITY = [
  'additionalProperties',
  'unevaluatedProperties',
  'required',
  'enum',
  'const',
  'type',
  'pattern',
];

/**
 * Reduce a validation's raw error list to ONE actionable diagnostic per instance location.
 *
 * A schema built from branches — the published DTCG schema dispatches group-vs-token through
 * `oneOf` — reports every branch's failure plus the envelope for a single defect. The branch
 * errors at one path describe one problem through different lenses; emitting them all buries the
 * answer, and an envelope error carries no location at all.
 */
function curate(errors: SchemaError[]): SchemaError[] {
  const rank = (error: SchemaError): number => {
    const index = KEYWORD_PRIORITY.indexOf(error.keyword);
    return index === -1 ? KEYWORD_PRIORITY.length : index;
  };
  const byPath = new Map<string, SchemaError>();
  for (const error of errors) {
    if (ENVELOPES.has(error.keyword)) continue;
    const held = byPath.get(error.instancePath);
    if (!held || rank(error) < rank(held)) {
      byPath.set(error.instancePath, error);
      continue;
    }
    // Tie-break: a MEMBER-NAME offender beats a `$`-key one. When a node is a token and a group
    // at once, the group branch reports '$value not permitted' and the token branch reports the
    // child's name — the child's name is the one the author recognises.
    if (rank(error) === rank(held)) {
      const key = offendingKey(error);
      if (key && !key.startsWith('$') && offendingKey(held)?.startsWith('$')) {
        byPath.set(error.instancePath, error);
      }
    }
  }

  // Ancestor-echo suppression. A broken child makes the parent's OTHER dispatch branch fail too:
  // the token branch of a group flags EVERY member as "not permitted" — false advice (the names
  // are fine; one subtree's content is broken). Two signatures, both requiring a surviving deeper
  // error so a genuine defect with a quiet subtree is never touched:
  //
  //   - the offender IS the segment leading to the deeper error (single-member echo), or
  //   - the path drew several DISTINCT non-$ offenders at once (the flag-every-member echo).
  //     That plurality is how an echo differs from a real vocabulary violation, whose offenders
  //     are exactly the invented names.
  const offendersAt = new Map<string, Set<string>>();
  for (const error of errors) {
    if (ENVELOPES.has(error.keyword)) continue;
    const key = offendingKey(error);
    if (!key || key.startsWith('$')) continue;
    const set = offendersAt.get(error.instancePath) ?? new Set<string>();
    set.add(key);
    offendersAt.set(error.instancePath, set);
  }

  const survivors = [...byPath.values()];
  return survivors.filter((error) => {
    const key = offendingKey(error);
    if (!key) return true;

    const survivorUnder = (prefix: string) =>
      survivors.some(
        (other) => other !== error && other.instancePath.startsWith(prefix),
      );

    const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
    if (survivorUnder(`${error.instancePath}/${escaped}`)) return false;
    if ((offendersAt.get(error.instancePath)?.size ?? 0) >= 2) {
      return !survivorUnder(`${error.instancePath}/`);
    }
    return true;
  });
}

function toDiagnostic(
  error: SchemaError,
  file: string,
  binding: SchemaBinding,
  registry: readonly object[],
): Diagnostic {
  const where = error.instancePath || '(root)';
  return {
    code: `${binding.domain ?? 'schema'}/${error.keyword}`,
    severity: binding.severity ?? 'error',
    message: `${where} ${describeFailure(error, binding, registry)}`,
    source: 'core',
    file,
    pointer: error.instancePath || undefined,
  };
}

/**
 * Validate raw collection files against their bound schemas, BEFORE parsing.
 *
 * Order matters: `parseCollection` produces a `Token[]` and has no channel to report a problem, so
 * anything malformed is silently dropped or coerced and every downstream validator inspects a model
 * that already lost the evidence. Checking the files themselves is what makes that class of mistake
 * visible at all.
 *
 * ajv is imported dynamically so it never enters the module graph of a consumer that does not
 * validate — core's main entry is bundled into the browser app.
 */
export async function validateFiles(
  files: Record<string, unknown>,
  bindings: SchemaBinding[] = defaultBindings(),
  referenced: object[] = [],
): Promise<Diagnostic[]> {
  const names = Object.keys(files);
  if (names.length === 0) return [];

  // One validator instance per DIALECT, created lazily. ajv fixes its dialect at construction and
  // never reads a schema's own `$schema` declaration, so the dispatch is our job — it is what lets
  // the draft-07 base (whose tuple `items` does not even compile as 2020-12) and a 2020-12
  // vocabulary validate in the same call, each under the dialect it declares.
  //
  // ajv is imported dynamically so it never enters the module graph of a consumer that does not
  // validate — core's main entry is bundled into the browser app.
  type Validator = {
    compile(schema: object): (data: unknown) => boolean;
    addSchema(schema: object): unknown;
  };
  const instances = new Map<string, Validator>();
  const instanceFor = async (schema: object): Promise<Validator> => {
    const dialect = dialectOf(schema);
    let ajv = instances.get(dialect);
    if (!ajv) {
      const mod =
        dialect === 'draft-07'
          ? await import('ajv')
          : dialect === '2019-09'
            ? await import('ajv/dist/2019.js')
            : await import('ajv/dist/2020.js');
      ajv = new mod.default({
        allErrors: true,
        strict: false,
        logger: false,
      }) as unknown as Validator;
      // Schemas reached through `$ref`, rewritten by the loader to these `$id`s. Refs only ever
      // resolve within one binding's graph (one dialect per ref-graph), but registering them into
      // every instance is harmless and keeps this simple.
      for (const ref of referenced) {
        try {
          ajv.addSchema(ref);
        } catch {
          // A duplicate `$id` is not fatal: the first registration wins.
        }
      }
      instances.set(dialect, ajv);
    }
    return ajv;
  };

  const diagnostics: Diagnostic[] = [];
  const compiled: Array<{
    binding: SchemaBinding;
    match: RegExp;
    validate: (data: unknown) => boolean;
  }> = [];

  for (const binding of bindings) {
    try {
      const ajv = await instanceFor(binding.schema);
      compiled.push({
        binding,
        match: globToRegExp(binding.match),
        // ajv validates against the meta-schema here and THROWS on a bad one. That check stays on:
        // it is what turns an author's typo into a message rather than a stack trace out of `check`.
        validate: ajv.compile(binding.schema) as (data: unknown) => boolean,
      });
    } catch (error) {
      diagnostics.push({
        code: 'schema/invalid-schema',
        severity: 'error',
        message: `binding '${binding.domain ?? binding.match}' is not valid JSON Schema: ${
          error instanceof Error ? error.message : String(error)
        }`,
        source: 'core',
      });
    }
  }

  for (const name of names) {
    const kind = isResolverFile(name) ? 'resolver' : 'tokens';
    for (const entry of compiled) {
      if ((entry.binding.target ?? 'tokens') !== kind) continue;
      if (!entry.match.test(name)) continue;
      if (entry.validate(files[name])) continue;
      const errors =
        (entry.validate as unknown as { errors?: SchemaError[] }).errors ?? [];
      for (const error of curate(errors)) {
        diagnostics.push(toDiagnostic(error, name, entry.binding, referenced));
      }
    }
  }
  return diagnostics;
}
