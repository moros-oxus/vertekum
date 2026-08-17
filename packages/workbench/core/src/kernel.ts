import {
  type ConfigStore,
  createConfigStore,
  scopedConfig,
} from './config/config-store';
import type { ExtensionManifest } from './config/manifest';
import { createDocument, type Document } from './document/document';
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
    list: () => commands.list(),
  };
}

export function createKernel(): Kernel {
  const document = createDocument();
  const services = createServiceRegistry();
  const commands = createCommandRegistry();
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
