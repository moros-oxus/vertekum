import type { Exporter } from '@vertekum/core';
import { z } from 'zod';
import type { FigmaDialect, OutputFile } from './dialect';
import { buildModel, type TypeContributor } from './model';

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
    const model = await buildModel(input, {
      composition: input.resolver.name,
      types: options.types,
    });
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
