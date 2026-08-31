import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';
import type { ExporterService } from '../export/exporter';
import type { Target } from '../export/target';

/** Service-registry key under which the validator registry is published. */
export const VALIDATOR_SERVICE = 'validator';

/*
 * There is no SCHEMA_SERVICE. Schemas are FILES named by `config.schemas`, resolved by
 * `loadSchemas` before the kernel starts — a registry existed only to turn a preset name into an
 * object, and the filesystem already does that.
 */

/**
 * One machine-readable problem (ADR-0030). `code` is `<domain>/<name>`; `file` is relative to the
 * project dir. Generalizes `ResolverIssue` so every kind of check speaks one vocabulary — which is
 * what lets an agent correct itself rather than only produce.
 */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  /** The extension id that produced it. */
  source: string;
  file?: string;
  target?: { kind: 'set' | 'modifier'; name: string };
  /**
   * JSON Pointer into the offending file (`/color/base/$value`) when the diagnostic came from
   * structural validation. Names the thing rather than where it sits in the file, which is what an
   * agent needs to correct itself — and schema validators report it natively, so it costs nothing.
   */
  pointer?: string;
}

/** The loaded project a validator inspects. */
export interface ValidationInput {
  tokens: Token[];
  sets: string[];
  resolvers: Map<string, ResolverDocument>;
  /** Configured export targets, when the runner knows them (CLI check/build). */
  targets?: Target[];
  /** The live exporter registry, for validators that check against it. */
  exporters?: ExporterService;
  /**
   * The raw collection trees, for validators whose subject is not token-shaped — group
   * `$extensions` payloads, carrier data. The token list cannot show an absence; the files can.
   */
  files?: Record<string, DtcgNode>;
}

/** A registered check. Extensions register these; `vertekum check` runs every one. */
export interface Validator {
  id: string;
  name: string;
  validate(input: ValidationInput): Diagnostic[] | Promise<Diagnostic[]>;
}

export interface ValidatorService {
  register(validator: Validator): void;
  list(): Validator[];
}
