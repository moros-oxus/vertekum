import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  build,
  defineConfig,
  type LintRuleLonghand,
  type LintRuleShorthand,
  type Plugin,
  parse,
} from '@terrazzo/parser';
import type {
  DtcgNode,
  Exporter,
  ExporterInput,
  OutputFile,
} from '@vertekum/core';
import { isResolverFile } from '@vertekum/core';
import { z } from 'zod';
import { correctKnownLimitations } from './to-terrazzo';

/**
 * Terrazzo plugin instances are live objects, so the schema validates the surrounding shape only —
 * a plugin's own options are its business. `describe` still publishes these keys, so an agent can
 * see what a target accepts without reading this source.
 *
 * STRICT: the surface exposes exactly the tool configuration that does not overlap the run
 * contract. The runner owns placement and sources — `outDir` is the target's `out`, and vertekum's
 * files ARE the sources — so a colliding terrazzo key must fail loudly, not vanish in a zod strip.
 */
export const TerrazzoOptions = z
  .object({
    plugins: z
      .array(z.unknown())
      .default([])
      .describe(
        'terrazzo plugin instances, e.g. css() from @terrazzo/plugin-css. No plugins means no output.',
      ),
    lint: z
      .record(z.unknown())
      .optional()
      .describe(
        "terrazzo lint rule overrides, merged over this exporter's defaults",
      ),
  })
  .strict();

/**
 * Terrazzo rejects the legacy string colour form by default. Values are stored in 2025.10 object
 * notation (`vertekum migrate values` converts older repos); the lint override keeps hex STRINGS
 * working too, since terrazzo converts those itself.
 */
/** terrazzo's own rule-config shape, so defaults and overrides merge into what it accepts. */
type LintRules = Record<string, LintRuleShorthand | LintRuleLonghand>;

const DEFAULT_LINT_RULES: LintRules = {
  'core/valid-color': ['error', { legacyFormat: true }],
};

interface TerrazzoOutputFile {
  filename: string;
  contents: string | Uint8Array;
}

/**
 * Vertekum passes the files; terrazzo resolves and formats.
 *
 * Hand-off is disk-based by terrazzo's design: its parser refuses in-memory sources beside a
 * resolver ("Resolver must be the only input") and loads the referenced set files from disk
 * itself. So the set files are STAGED — verbatim, except the two known-limitation corrections —
 * and the target's resolver is handed in-memory with a filename inside the staging dir. With no
 * composition, the corrected set files go in directly as plain multi-sources.
 *
 * This also makes the exporter Node-only. A browser invocation fails on the missing `files` (or
 * on `node:fs`) rather than silently emitting nothing.
 */
export const terrazzoExporter: Exporter = {
  id: 'terrazzo',
  name: 'Terrazzo',
  optionsSchema: TerrazzoOptions,
  async transform(input: ExporterInput): Promise<OutputFile[]> {
    const options = TerrazzoOptions.parse(input.options ?? {});
    if (options.plugins.length === 0) return [];
    if (!input.files) {
      throw new Error(
        'terrazzo exporter needs the collection files (ExporterInput.files) — run through `vertekum build`',
      );
    }

    const staging = await mkdtemp(join(tmpdir(), 'vertekum-terrazzo-'));
    try {
      const corrected: Array<[string, DtcgNode]> = Object.entries(input.files)
        .filter(([name]) => !isResolverFile(name))
        .map(([name, tree]) => [
          name,
          correctKnownLimitations(
            tree,
            input.tokens,
            name.replace(/\.json$/, ''),
          ),
        ]);
      for (const [name, tree] of corrected) {
        // Nested set names (`brands/brand-a.json`) need their directories staged too.
        await mkdir(dirname(join(staging, name)), { recursive: true });
        await writeFile(join(staging, name), JSON.stringify(tree));
      }

      const cwd = pathToFileURL(`${staging}/`);
      const config = defineConfig(
        {
          // The options schema guarantees an array and a record; what a plugin or a rule IS stays
          // terrazzo's to validate (it refuses a malformed one loudly), so they pass as its types.
          plugins: options.plugins as Plugin[],
          lint: {
            rules: {
              ...DEFAULT_LINT_RULES,
              ...((options.lint ?? {}) as LintRules),
            },
          },
        },
        { cwd },
      );

      // A composition hands terrazzo the resolver, which loads the staged sets itself; flat
      // targets hand the corrected sets directly. The resolver goes over AS AUTHORED (the raw
      // file when present) — re-serializing the parsed document could drop authored detail.
      const resolverFile = `${input.resolver.name ?? 'default'}.resolver.json`;
      const sources =
        Object.keys(input.resolver.sets).length > 0
          ? [
              {
                filename: new URL(resolverFile, cwd),
                src: JSON.stringify(
                  input.files[resolverFile] ?? input.resolver,
                ),
              },
            ]
          : corrected.map(([name, tree]) => ({
              filename: new URL(name, cwd),
              src: JSON.stringify(tree),
            }));

      const parsed = await parse(sources, { config });
      // 2.7's build wants the parse result's resolver too — plugins (e.g. plugin-js) walk its
      // permutations for mode output.
      const result = await build(parsed.tokens, {
        resolver: parsed.resolver,
        sources: parsed.sources,
        config,
      });

      const files: TerrazzoOutputFile[] = Array.isArray(result)
        ? result
        : (result?.outputFiles ?? []);

      return files.map((file) => ({
        path: String(file.filename),
        content: String(file.contents),
      }));
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  },
};
