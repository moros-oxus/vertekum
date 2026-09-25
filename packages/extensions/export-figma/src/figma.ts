import type { Exporter } from '@vertekum/core';
import { z } from 'zod';
import type { FigmaDialect, OutputFile } from './dialect';
import { fingerprintOf } from './fingerprint';
import { type BuiltComposition, mergeModels } from './merge';
import { buildModelWithDeps, claimsOf, type TypeContributor } from './model';

/**
 * The `figma` exporter: builds the Figma-shaped model from the resolved composition and emits it
 * as the canonical artifact (`figma.model.json` — the `vertekum` dialect, always on), then runs
 * each configured dialect writer over the model. Writers and type contributors are config-passed
 * plugs (the terrazzo pattern): no registry, third parties ship them as packages.
 */

export interface FigmaOptions {
  /** Per-$type model contributors for custom types (e.g. a per-side unfolder). */
  types?: Record<string, TypeContributor>;
  /** Dialect writers; the canonical model is emitted regardless. */
  dialects?: FigmaDialect[];
}

const OPTIONS = z
  .object({
    types: z
      .record(z.custom<TypeContributor>((v) => typeof v === 'function'))
      .optional(),
    dialects: z
      .array(
        z.object({
          id: z.string(),
          write: z.custom<FigmaDialect['write']>(
            (v) => typeof v === 'function',
          ),
        }),
      )
      .optional(),
  })
  .optional();

export const figmaExporter: Exporter = {
  id: 'figma',
  name: 'Figma model',
  optionsSchema: OPTIONS,
  async transform(input) {
    const options = (input.options ?? {}) as FigmaOptions;
    // One model per composition, then merged. A single-composition target takes the same path:
    // the merge stamps identity and leaves one model untouched.
    const resolved = input.compositions?.length
      ? input.compositions
      : [
          {
            name: input.resolver.name ?? '',
            base: input.base,
            variants: input.variants,
            resolver: input.resolver,
          },
        ];
    // Ownership is decided ONCE, across every composition: a path one composition's modifier
    // owns lands in that modifier's collection for all of them (each contributing its own
    // contexts as modes), so no variable is split across collections by brand.
    const ownershipNotices: string[] = [];
    const claimed = new Map<string, string>();
    for (const composition of resolved) {
      for (const [path, modifier] of claimsOf(
        composition.resolver,
        input.tokens,
        ownershipNotices,
      )) {
        const held = claimed.get(path);
        if (held === undefined) claimed.set(path, modifier);
        else if (held !== modifier) {
          ownershipNotices.push(
            `'${path}' is owned by '${held}' in one composition and '${modifier}' in '${composition.name}' — modelled under '${held}'`,
          );
        }
      }
    }
    const built: BuiltComposition[] = [];
    for (const composition of resolved) {
      const { model, deps } = await buildModelWithDeps(
        {
          base: composition.base,
          variants: composition.variants,
          resolver: composition.resolver,
          tokens: input.tokens,
        },
        {
          composition: composition.name || undefined,
          types: options.types,
          claimed,
        },
      );
      built.push({ composition: composition.name, model, deps });
    }
    const model = mergeModels(built, input.target);
    model.source.notices.unshift(...new Set(ownershipNotices));
    model.source.fingerprint = await fingerprintOf(model);
    const files: OutputFile[] = [
      {
        path: 'figma.model.json',
        content: `${JSON.stringify(model, null, 2)}\n`,
      },
    ];
    for (const dialect of options.dialects ?? []) {
      for (const file of dialect.write(model)) {
        files.push({
          path: `${dialect.id}/${file.path}`,
          content: file.content,
        });
      }
    }
    return files;
  },
};
