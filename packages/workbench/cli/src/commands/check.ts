import type { DtcgNode } from '@vertekum/core';
import {
  assembleBindings,
  builtinValidators,
  type Diagnostic,
  dtcg,
  EXPORTER_SERVICE,
  type ExporterService,
  isResolverFile,
  SCHEMA_BINDING_SERVICE,
  type SchemaBindingService,
  VALIDATOR_SERVICE,
  type ValidatorService,
  validateFiles,
} from '@vertekum/core';
import { readCollection } from '@vertekum/core/node';
import type { Project } from '../loadProject';
import { readTargets } from './build';

/**
 * Structural validation, against the files as they sit on disk.
 *
 * Reading them again rather than re-serializing the document is the whole point: parsing drops what
 * it does not understand, so a problem that does not survive the round trip — a mistyped `$vaule`,
 * a node the parser skipped — would be invisible in a re-serialization. Only the source shows it.
 */
async function collectStructural(
  project: Project,
  files?: Record<string, DtcgNode>,
): Promise<Diagnostic[]> {
  const source = files ?? (await readCollection(project.collectionDir));

  // Resolved once when the project booted. DTCG well-formedness is among them — a built-in binding
  // a configured entry may replace, not a separate concept layered on afterwards.
  const { bindings, referenced, diagnostics } = project.schemas;

  // Extension-contributed bindings join the loader's, then ASSEMBLY makes one coherent set:
  // cross-route id resolution (an extension can eject as config can), `$extends` patches merged
  // into the effective DTCG schema, and the `dtcg#` anchor shell derived from the result.
  const contributed =
    project.kernel.services
      .get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)
      ?.list() ?? [];
  const assembled = assembleBindings([...bindings, ...contributed]);

  return [
    // A schema that could not be read, a remote `$ref`, a binding that enforces nothing — decided at
    // load time, reported here, so `check` stays the one place a project asks what is wrong.
    ...diagnostics,
    ...assembled.diagnostics,
    ...resolverSourceProblems(source),
    ...(await validateFiles(source, assembled.bindings, [
      ...referenced,
      ...assembled.referenced,
    ])),
  ];
}

/**
 * A resolver source `$ref` naming a file the collection does not contain.
 *
 * STRUCTURAL, and therefore unconditional. Whether a referenced file exists is the same class of
 * question as whether a file is well-formed, and the answer must not depend on which extensions a
 * project happens to install — `@vertekum/ext-themes` already reported this, but a project without
 * it got nothing at all.
 *
 * Silence here is expensive out of proportion to the typo: an unmatched `$ref` resolves to an EMPTY
 * set, and an empty set has no references to check, so it also silences the alias validator. One
 * mistyped source can therefore hide a dangling reference somewhere else entirely.
 *
 * Only `unknown-source` is reported here. The rest of `validateResolver`'s vocabulary — a default
 * naming no context, a modifier with none — is semantic rather than structural and stays with the
 * composition validator that owns it.
 */
function resolverSourceProblems(files: Record<string, DtcgNode>): Diagnostic[] {
  const known = new Set(
    Object.keys(files).filter((name) => !isResolverFile(name)),
  );

  const out: Diagnostic[] = [];
  for (const [name, tree] of Object.entries(files)) {
    if (!isResolverFile(name)) continue;
    const issues = dtcg.resolvers.validateResolver(
      dtcg.resolvers.parseResolver(tree),
      known,
    );
    for (const issue of issues) {
      if (issue.code !== 'unknown-source') continue;
      out.push({
        code: `resolver/${issue.code}`,
        severity: issue.severity,
        message: issue.message,
        source: 'core',
        file: name,
        ...(issue.target ? { target: issue.target } : {}),
      });
    }
  }
  return out;
}

/**
 * Diagnostics for a PROPOSED document rather than what is on disk — how a verb checks its own work
 * before anything is written.
 */
export async function collectProposed(project: Project): Promise<Diagnostic[]> {
  const structural = await collectStructural(
    project,
    project.document.getFiles(),
  );
  if (structural.some((d) => d.severity === 'error')) return structural;
  return [...structural, ...(await collectRelational(project))];
}

/**
 * Run the built-in validators, then every registered one (ADR-0030). The built-ins are
 * spec-mandated behaviour — reference validity, resolver semantics — and run with no extensions
 * installed, exactly like the built-in format binding.
 */
async function collectRelational(project: Project): Promise<Diagnostic[]> {
  const registry =
    project.kernel.services.get<ValidatorService>(VALIDATOR_SERVICE);
  const input = {
    tokens: project.document.getAllTokens(),
    sets: project.document.getSets(),
    resolvers: project.document.getResolvers(),
    targets: readTargets(project),
    exporters: project.kernel.services.get<ExporterService>(EXPORTER_SERVICE),
  };
  const out: Diagnostic[] = [];
  for (const validator of [...builtinValidators, ...(registry?.list() ?? [])]) {
    out.push(...(await validator.validate(input)));
  }
  return out;
}

/**
 * Structural checks first, then relational ones. A structural *error* stops the pass: the parsed
 * model is built from files already known to be malformed, so alias and composition diagnostics
 * derived from it would be noise at best and misdirection at worst. Warnings do not stop it.
 */
export async function collectDiagnostics(
  project: Project,
): Promise<Diagnostic[]> {
  const structural = await collectStructural(project);
  if (structural.some((d) => d.severity === 'error')) return structural;
  return [...structural, ...(await collectRelational(project))];
}

/** Format one diagnostic for a terminal: `severity  code  message  (file)`. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.file ? `  (${diagnostic.file})` : '';
  return `${diagnostic.severity}  ${diagnostic.code}  ${diagnostic.message}${where}`;
}

export { collectRelational, collectStructural };

export interface CheckOptions {
  project: Project;
  json?: boolean;
}

/** `vertekum check`. Exit 1 when any diagnostic is an error; warnings alone exit 0. */
export async function runCheck(options: CheckOptions): Promise<number> {
  const diagnostics = await collectDiagnostics(options.project);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: errors === 0, errors, warnings, diagnostics }, null, 2)}\n`,
    );
  } else if (diagnostics.length === 0) {
    process.stdout.write('no problems found\n');
  } else {
    for (const diagnostic of diagnostics) {
      process.stdout.write(`${formatDiagnostic(diagnostic)}\n`);
    }
    process.stdout.write(`\n${errors} error(s), ${warnings} warning(s)\n`);
  }
  return errors > 0 ? 1 : 0;
}
