import type { ZodTypeAny } from 'zod';
import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';

/** Service-registry key under which @vertekum/ext-export publishes the exporter registry. */
export const EXPORTER_SERVICE = 'exporter';

/** One emitted artifact. `path` is relative; the caller (route/CLI) decides the output dir + writes it. */
export interface OutputFile {
  path: string;
  content: string;
}

/** What an exporter receives: a pre-resolved bundle (base + per-context) AND the raw resolver + tokens. */
export interface ExporterInput {
  base: Token[];
  variants: Array<{ modifier: string; context: string; tokens: Token[] }>;
  resolver: ResolverDocument;
  tokens: Token[];
  /**
   * The collection's raw file trees (sets and resolvers), verbatim, keyed by file name. For
   * exporters that hand files to an external tool rather than consuming resolved bundles.
   */
  files?: Record<string, DtcgNode>;
  options?: unknown;
}

/** A pure, headless output format. Async-capable (e.g. a terrazzo bridge awaits its own build). */
export interface Exporter {
  id: string;
  name: string;
  /**
   * The shape of a target's `options` for THIS exporter. `check` validates against it and
   * `describe` publishes it, so an agent can configure a third-party exporter without reading its
   * source (ADR-0029). The exporter owns the meaning of `options`; the target shape stays fixed.
   */
  optionsSchema?: ZodTypeAny;
  transform(input: ExporterInput): OutputFile[] | Promise<OutputFile[]>;
}

/** The registry (seeded by the kernel; exporter extensions get() it and register their plugs). */
export interface ExporterService {
  register(exporter: Exporter): void;
  get(id: string): Exporter | undefined;
  list(): Exporter[];
  subscribe(listener: () => void): () => void;
}
