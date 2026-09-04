import {
  type ConfigStore,
  createConfigStore,
  scopedConfig,
} from './config/config-store';
import type { ExtensionManifest } from './config/manifest';
import {
  createTokenCodecRegistry,
  TOKEN_CODEC_SERVICE,
} from './document/codec';
import { createDocument, type Document } from './document/document';
import { EXPORTER_SERVICE } from './export/exporter';
import { createExporterRegistry } from './export/registry';
import { createCommandRegistry } from './shell/command-registry';
import { createServiceRegistry } from './shell/service-registry';
import type {
  CommandRegistry,
  Extension,
  ExtensionContext,
  ExtensionContributions,
  InstalledExtension,
  ServiceRegistry,
} from './shell/types';
import {
  createSchemaBindingRegistry,
  SCHEMA_BINDING_SERVICE,
} from './validate/binding-registry';
import { builtinCommands } from './verbs/index';

/** The thin kernel: document store, registries, config engine, and extension host (ADR-0009). */
export interface Kernel {
  document: Document;
  services: ServiceRegistry;
  commands: CommandRegistry;
  config: ConfigStore;
  context: ExtensionContext;
  register<M extends ExtensionManifest>(extension: Extension<M>): void;
  start(): void;
  /** The installed extensions with their truthful, provenance-recorded contributions (ADR-0027). */
  getExtensions(): InstalledExtension[];
}

/** Wrap a service registry so every register(key) is recorded under the activating extension. */
function attributeServices(
  services: ServiceRegistry,
  contrib: ExtensionContributions,
): ServiceRegistry {
  return {
    register(key, service) {
      contrib.services.push(key);
      services.register(key, service);
    },
    get: (key) => services.get(key),
  };
}

/** Wrap a command registry so every register() is also recorded under the activating extension. */
function attributeCommands(
  commands: CommandRegistry,
  contrib: ExtensionContributions,
): CommandRegistry {
  return {
    register(command) {
      contrib.commands.push(command.name);
      commands.register(command);
    },
    extend(name, extension) {
      contrib.commands.push(`${name} (extended)`);
      commands.extend(name, extension);
    },
    list: () => commands.list(),
    extensionsOf: (name) => commands.extensionsOf(name),
  };
}

export function createKernel(): Kernel {
  // Codecs before the document: the token view derives through them (extension-held token data).
  const codecs = createTokenCodecRegistry();
  const document = createDocument({ codecs: () => codecs.list() });
  // A codec registered after hydration must reach the already-derived view — without a version
  // bump, so a runner never mistakes a registration for an edit to persist.
  codecs.subscribe(() => document.invalidateDerived());
  const services = createServiceRegistry();
  const commands = createCommandRegistry();
  // Core itself consumes both registries (parse, check), so they exist before any extension
  // activates — registered on the raw services registry like the built-in verbs, unattributed.
  services.register(TOKEN_CODEC_SERVICE, codecs);
  services.register(SCHEMA_BINDING_SERVICE, createSchemaBindingRegistry());
  // The exporter registry is core's interface (the curation-floor reframe): seeded here like the
  // codec and schema-binding registries, so an exporter extension just get()s and registers —
  // the historical get-or-create ritual (ext-export ownership, ADR-0023) is no longer needed.
  services.register(EXPORTER_SERVICE, createExporterRegistry());
  // Core's own curation verbs, registered before any extension activates. They go through the same
  // registry contributed commands use, so a client sees one list and cannot tell a built-in verb
  // from a contributed one. Registered on the RAW registry, not an attributed wrapper — they belong
  // to core, and crediting them to whichever extension happens to activate first would be a lie.
  for (const command of builtinCommands()) commands.register(command);
  const config = createConfigStore();
  const extensions: Extension[] = [];
  const contributions = new Map<string, ExtensionContributions>();
  const context: ExtensionContext = {
    document,
    services,
    commands,
    // Outside activation there is no extension to attribute to; a host using the raw context is
    // registering on its own behalf, which is not a contribution.
    contribute: () => {},
  };
  let started = false;

  const contributionsFor = (id: string): ExtensionContributions =>
    contributions.get(id) ?? { services: [], commands: [] };

  return {
    document,
    services,
    commands,
    config,
    context,
    register(extension) {
      config.registerSchema(extension.manifest.id, extension.manifest.settings);
      contributions.set(extension.manifest.id, { services: [], commands: [] });
      extensions.push(extension);
    },
    start() {
      if (started) return;
      started = true;
      for (const extension of extensions) {
        const contrib = contributionsFor(extension.manifest.id);
        extension.activate({
          document,
          services: attributeServices(services, contrib),
          commands: attributeCommands(commands, contrib),
          config: scopedConfig(config, extension.manifest.id),
          contribute(kind, value) {
            const bucket = (contrib[kind] as unknown[]) ?? [];
            bucket.push(value);
            contrib[kind] = bucket;
          },
        });
      }
    },
    getExtensions() {
      return extensions.map((e) => ({
        manifest: e.manifest,
        contributions: contributionsFor(e.manifest.id),
        active: started,
      }));
    },
  };
}
