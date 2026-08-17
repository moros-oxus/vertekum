/**
 * The DTCG Resolver Module (2025.10) — the truth of *theme composition*: which sets combine, under
 * which modifier contexts, in what order. Values still live in the token sets; a resolver only
 * references them. R1 models and round-trips this shape; it is not interpreted (no resolution) yet.
 */

/** A reference to a token-set file, e.g. `{ $ref: 'core.json' }`. */
export interface SourceRef {
  $ref: string;
}
/** A resolver source: a set-file reference OR inline DTCG tokens. */
export type Source = SourceRef | Record<string, unknown>;

export interface ResolverSet {
  description?: string;
  sources: Source[];
}
export interface ResolverModifier {
  description?: string;
  /** context name → the sources it contributes. */
  contexts: Record<string, Source[]>;
  /** Must be one of `contexts`' keys (validated in R3, not here). */
  default?: string;
}
export interface ResolverDocument {
  version: '2025.10';
  name?: string;
  description?: string;
  sets: Record<string, ResolverSet>;
  modifiers: Record<string, ResolverModifier>;
  /** Ordered set/modifier references: '#/sets/…' | '#/modifiers/…'. */
  resolutionOrder: Array<{ $ref: string }>;
  /** Pass-through fields preserved verbatim on round-trip. */
  $schema?: string;
  $defs?: Record<string, unknown>;
  $extensions?: Record<string, unknown>;
}

/** A blank resolver for the create flow (R2). */
export function emptyResolver(): ResolverDocument {
  return { version: '2025.10', sets: {}, modifiers: {}, resolutionOrder: [] };
}

/** A selection of modifier name → chosen context name, driving structure-level resolution. */
export type ResolverSelection = Record<string, string>;

export type ResolverIssueCode =
  | 'unknown-source'
  | 'dangling-ref'
  | 'bad-default'
  | 'empty-contexts'
  | 'single-context';

/** A semantic problem found by `validateResolver`. `error` should block authoring; `warning` is advisory. */
export interface ResolverIssue {
  code: ResolverIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** The owning set/modifier, for grouping/surfacing; for a dangling ref, parsed from the order `$ref`. */
  target?: { kind: 'set' | 'modifier'; name: string };
  /** `unknown-source` only: the offending source `$ref`. */
  ref?: string;
}
