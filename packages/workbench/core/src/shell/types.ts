import type { ActivateContext, ExtensionManifest } from '../config/manifest';
import type { Document } from '../document/document';

/**
 * A key→service map for cross-extension collaboration (ADR-0022). Publishers register a
 * service under a well-known key; consumers `get` it and degrade if absent. The service's
 * shape is a contract defined in `@vertekum/core`, so the two never import each other.
 */
export interface ServiceRegistry {
  register<T>(key: string, service: T): void;
  get<T>(key: string): T | undefined;
}

/** The kernel surface handed to an extension on activation (ADR-0009). */
/** One positional parameter of a contributed command. */
export interface CommandArg {
  name: string;
  required?: boolean;
  description?: string;
}

/** What a handler receives. `project` is the CLI's Project — core does not depend on the CLI. */
export interface CommandContext {
  project: unknown;
  args: Record<string, string>;
  options: Record<string, unknown>;
}

/** A command's voice. The runner renders it; handlers never print. */
export interface CommandResult {
  summary?: string;
  data?: unknown;
  /**
   * File artifacts the command produces (ADR-0030 amendment). Handlers never touch the
   * filesystem — they DECLARE files here, paths relative to the working directory, and the runner
   * owns writing them, which is what keeps `--dry-run` and `--json` true for every command.
   */
  files?: Array<{ path: string; content: string }>;
}

/**
 * A CLI command contributed by an extension (ADR-0030 amendment). Framework-neutral by design: the
 * host maps this onto its CLI library, so extensions never import one — the same reason `MountFn`
 * hands a route a DOM element rather than React (ADR-0017).
 */
export interface CommandDescriptor {
  /** Space-separated path: 'token rename' becomes `vertekum token rename`. */
  name: string;
  description: string;
  args?: CommandArg[];
  options?: Array<{ flag: string; description: string }>;
  /**
   * A handler may return a result or nothing, synchronously or not. Sync is included deliberately:
   * most curation verbs are pure document mutations with nothing to await, and forcing them async
   * would be ceremony.
   */
  run(
    ctx: CommandContext,
    // biome-ignore lint/suspicious/noConfusingVoidType: a handler returning nothing is void, sync or awaited
  ): void | CommandResult | Promise<void | CommandResult>;
}

export interface CommandRegistry {
  register(command: CommandDescriptor): void;
  list(): CommandDescriptor[];
}

export interface ExtensionContext {
  document: Document;
  services: ServiceRegistry;
  commands: CommandRegistry;
  /**
   * Record a contribution under the activating extension, for provenance (ADR-0027).
   *
   * Core owns *attribution* because knowing who contributed what is a system concern; it does not
   * own the *kinds*. A UI host publishes a route service and records `contribute('routes', …)`, so
   * core never learns what a route is — which is what keeps presentation out of the system.
   */
  contribute(kind: string, value: unknown): void;
}

export interface Extension<M extends ExtensionManifest = ExtensionManifest> {
  manifest: M;
  activate(ctx: ActivateContext<M>): void;
}

/**
 * What an extension actually registered during activate(). `services` and `commands` are recorded
 * by core's attributed registries; any other kind arrives through `ExtensionContext.contribute`,
 * so a host can record kinds core has never heard of (routes, slots) without core defining them.
 */
export interface ExtensionContributions {
  services: string[];
  commands: string[];
  [kind: string]: unknown[];
}

/** A registered extension plus its truthful contributions and activation state (kernel introspection). */
export interface InstalledExtension {
  manifest: ExtensionManifest;
  contributions: ExtensionContributions;
  active: boolean;
}
