import type { ActivateContext, ExtensionManifest } from '../config/manifest';
import type { Document } from '../document/document';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';

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

/**
 * One link in a command's extension chain — the chain of responsibility settled in the curation-
 * floor design. A context flows down the chain; a handler PROPOSES by returning, PASSES by
 * returning nothing, or REFUSES by throwing (the verb error the runner renders). Handlers never
 * write — the command applies the outcome once, which is what keeps undo at one step per action.
 *
 * Each extensible command publishes its own context/proposal contract (`ValuePreparationContext`,
 * `InterchangePresentationContext`); the registry stores links untyped because it spans them all.
 */
export interface CommandExtension<C = unknown, P = unknown> {
  /**
   * Options this extension adds to the command's surface. Declared statically because the CLI
   * needs the complete flag set at parse time, before any handler has seen a value.
   */
  options?: Array<{ flag: string; description: string }>;
  handle(context: C): P | undefined | Promise<P | undefined>;
}

/**
 * The chain context of `token add` / `token set` — consulted BEFORE the missing-type refusal and
 * before the built-in short-form transforms, so a handler can settle either. References and JSON
 * objects never reach the chain (spec behaviour: they pass through untransformed).
 */
export interface ValuePreparationContext {
  /** Read-only: walk groups and siblings to make decisions. */
  document: Document;
  set: string;
  path: string[];
  /**
   * Type provenance. `explicit` is the author's flag and always wins; `inherited` is the nearest
   * group declaration (or, for `token set`, the token's current effective type); `current` is what
   * the chain has proposed so far. Effective type after the chain: explicit ?? current ?? inherited.
   */
  type: { explicit?: string; inherited?: string; current?: string };
  /** `original` is the raw argument; `current` is the value as prepared so far. */
  value: { original: string; current: unknown };
}

/** A value-preparation proposal. Partial is idiomatic: propose a type alone and the built-in
 *  transform parses the value downstream — "let the chain ride". */
export interface ValueProposal {
  type?: string;
  value?: unknown;
}

/**
 * The chain context of `build` — one consult per staged token while core prepares the interchange
 * files every exporter receives. A proposal replaces the node exporters will see; the stored
 * document is never touched.
 */
export interface InterchangePresentationContext {
  /** The model token being staged (path, set, type, materialized value). */
  token: Token;
  /** `original` is the node as staged today; `current` is what the chain has proposed so far. */
  node: { original: DtcgNode; current: DtcgNode };
}

export interface CommandRegistry {
  register(command: CommandDescriptor): void;
  /**
   * Join the chain of an existing command. The name must be a registered command or a declared
   * extensible point (`build`, whose chain core consults while staging exports) — anything else
   * throws, so a typo is an activation error rather than a chain nobody consults.
   */
  extend(name: string, extension: CommandExtension): void;
  list(): CommandDescriptor[];
  /** The chain for one command, in registration (= config `extensions: []`) order. */
  extensionsOf(name: string): CommandExtension[];
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
