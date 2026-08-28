import {
  assembleBindings,
  builtinValidators,
  EXPORTER_SERVICE,
  type ExporterService,
  SCHEMA_BINDING_SERVICE,
  type SchemaBinding,
  type SchemaBindingService,
  VALIDATOR_SERVICE,
  type ValidatorService,
} from '@vertekum/core';
import type { Project } from '../loadProject';

/** The same assembly `check` runs — one truth for what is in effect. */
function assembledBindings(project: Project): SchemaBinding[] {
  const contributed =
    project.kernel.services
      .get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)
      ?.list() ?? [];
  return assembleBindings([...project.schemas.bindings, ...contributed])
    .bindings;
}

export interface DescribeOptions {
  project: Project;
  json?: boolean;
  withUi?: boolean;
}

/** A shallow, agent-readable summary of a Zod options schema: its keys and their descriptions. */
function describeSchema(schema: unknown): unknown {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  if (!shape) return null;
  return Object.fromEntries(
    Object.keys(shape).map((key) => [
      key,
      (shape[key] as { description?: string })?.description ?? true,
    ]),
  );
}

/**
 * `vertekum describe`: the inventory that exists nowhere on disk (ADR-0030) — what CAN be
 * configured, as opposed to what IS. Availability is decided at activation by code inside
 * packages, so no file answers "which exporters exist here". Configured targets are deliberately
 * not echoed back; they are readable from the config file.
 */
export async function runDescribe(options: DescribeOptions): Promise<number> {
  const project = options.project;
  const exporters =
    project.kernel.services.get<ExporterService>(EXPORTER_SERVICE)?.list() ??
    [];
  // Built-ins first — they run with no extensions installed, and the inventory must say so.
  const validators = [
    ...builtinValidators,
    ...(project.kernel.services
      .get<ValidatorService>(VALIDATOR_SERVICE)
      ?.list() ?? []),
  ];
  const info = {
    project: {
      configPath: project.configPath ?? null,
      projectDir: project.projectDir,
      collectionDir: project.collectionDir,
      sets: project.document.getSets(),
      tokenCount: project.document.getAllTokens().length,
    },
    extensions: project.kernel.getExtensions().map((e) => ({
      id: e.manifest.id,
      name: e.manifest.name,
      description: e.manifest.description ?? null,
      services: e.contributions.services,
    })),
    exporters: exporters.map((e) => ({
      id: e.id,
      name: e.name,
      options: e.optionsSchema ? describeSchema(e.optionsSchema) : null,
    })),
    validators: validators.map((v) => ({ id: v.id, name: v.name })),
    // What CONSTRAINS this project. An agent should be able to ask, rather than discover it by
    // failing. Schema bodies are deliberately not serialized — describe is an inventory, not a dump
    // — but the resolved PATH is, because that is what lets an agent open the file and read the
    // permitted vocabulary for itself.
    // The ASSEMBLED view — extension-registered bindings and `$extends` patches included — with
    // each binding's origin, so "which schema is in effect and who supplied it" is inspectable.
    schemas: assembledBindings(project).map((b) => ({
      id: b.id ?? null,
      match: b.match,
      target: b.target ?? 'tokens',
      domain: b.domain ?? 'schema',
      severity: b.severity ?? 'error',
      file: b.file ?? null,
      origin: b.origin ?? null,
    })),
    // What an agent can RUN here — like exporters, this exists nowhere on disk.
    commands: project.kernel.commands.list().map((c) => ({
      name: c.name,
      description: c.description,
      args: (c.args ?? []).map((a) => a.name),
      options: (c.options ?? []).map((o) => o.flag),
    })),
    compositions: [...project.document.getResolvers()].map(([name, doc]) => ({
      name,
      modifiers: Object.fromEntries(
        Object.entries(doc.modifiers).map(([key, modifier]) => [
          key,
          {
            contexts: Object.keys(modifier.contexts),
            default: modifier.default ?? null,
          },
        ]),
      ),
    })),
    // Routes come from the extensions' recorded provenance, not from a registry: core no longer
    // owns one, and a headless run has no UI host to publish one. What an extension WOULD
    // contribute is still knowable, which is the honest answer here.
    ...(options.withUi
      ? {
          routes: project.kernel
            .getExtensions()
            .flatMap((e) => (e.contributions.routes ?? []) as unknown[]),
        }
      : {}),
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
  } else {
    process.stdout.write(`project      ${info.project.projectDir}\n`);
    process.stdout.write(`collection   ${info.project.collectionDir}\n`);
    process.stdout.write(
      `extensions   ${info.extensions.map((e) => e.id).join(', ')}\n`,
    );
    process.stdout.write(
      `exporters    ${info.exporters.map((e) => e.id).join(', ')}\n`,
    );
    process.stdout.write(
      `validators   ${info.validators.map((v) => v.id).join(', ')}\n`,
    );
    // One row per binding rather than a joined line: the path is the useful part, and a path list
    // squeezed onto one line is unreadable at exactly the moment someone needs to read it.
    if (info.schemas.length === 0) {
      process.stdout.write('schemas      —\n');
    }
    for (const [index, binding] of info.schemas.entries()) {
      const label = index === 0 ? 'schemas     ' : '            ';
      process.stdout.write(
        `${label} ${binding.domain} (${binding.match}, ${binding.severity})${
          binding.file ? ` ${binding.file}` : ''
        }\n`,
      );
    }
    process.stdout.write(
      `compositions ${info.compositions.map((c) => c.name).join(', ')}\n`,
    );
    process.stdout.write(
      `commands     ${info.commands.map((c) => c.name).join(', ') || '—'}\n`,
    );
  }
  return 0;
}
