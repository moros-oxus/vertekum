import type { ResolverDocument } from '../document/resolver-types';
import { emptyResolver } from '../document/resolver-types';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';
import type { ExporterInput, ExporterService, OutputFile } from './exporter';
import { resolveExporterInput } from './resolve-input';

/**
 * A configured, repeatable export target (ADR-0018): which exporter runs, over which composition,
 * with what options, writing where. Declared in config; run by `vertekum build` and by the export
 * route, so both drive one code path.
 */
export interface Target {
  /** Defaults to `exporter`; must be unique across targets. Selected by `--target`. */
  id?: string;
  /** An exporter id from the registry. */
  exporter: string;
  /** A resolver document name. Omitted means flat: all tokens, no resolution. */
  composition?: string;
  /** Output dir, relative to the project dir. */
  out: string;
  /** Passed through as `ExporterInput.options`; validated against the exporter's schema. */
  options?: unknown;
  /** Defaults to true. A disabled target is skipped unless named explicitly. */
  enabled?: boolean;
}

export interface TargetResult {
  id: string;
  target: Target;
  files: OutputFile[];
}

/** A target's effective id: its own, or the exporter's. */
export function targetId(target: Target): string {
  return target.id ?? target.exporter;
}

/**
 * The run model: resolve each target's composition, run its exporter, return the emitted files.
 * Pure — no filesystem. The caller writes (Node `fs` for the CLI, the bridge for the browser).
 * Disabled targets are skipped unless named in `only`, since naming one is explicit intent.
 */
export async function runTargets(
  targets: Target[],
  ctx: {
    registry: ExporterService;
    tokens: Token[];
    resolvers: Map<string, ResolverDocument>;
    /** The collection's raw file trees, for exporters that hand files to an external tool. */
    files?: Record<string, DtcgNode>;
    only?: string[];
  },
): Promise<TargetResult[]> {
  const selected = targets.filter((t) =>
    ctx.only ? ctx.only.includes(targetId(t)) : t.enabled !== false,
  );
  const results: TargetResult[] = [];
  for (const target of selected) {
    const exporter = ctx.registry.get(target.exporter);
    if (!exporter) {
      throw new Error(`unknown exporter '${target.exporter}'`);
    }
    let input: ExporterInput;
    if (target.composition === undefined) {
      input = {
        base: ctx.tokens,
        variants: [],
        resolver: emptyResolver(),
        tokens: ctx.tokens,
      };
    } else {
      const resolver = ctx.resolvers.get(target.composition);
      if (!resolver) {
        throw new Error(`unknown composition '${target.composition}'`);
      }
      input = resolveExporterInput(resolver, ctx.tokens);
    }
    const files = await exporter.transform({
      ...input,
      files: ctx.files,
      options: target.options,
    });
    results.push({ id: targetId(target), target, files });
  }
  return results;
}
