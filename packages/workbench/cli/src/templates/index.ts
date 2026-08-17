/**
 * The files `vertekum init` writes into a consuming repo. They are TypeScript string constants
 * rather than files on disk: packages publish raw source, so a template *file* would depend on the
 * `files` allowlist and on path resolution from inside `node_modules`. Strings sidestep both.
 */

/** The consumer config. Deliberately minimal — one collection; validation is core builtins. */
export const CONFIG_TEMPLATE = `import { defineConfig } from '@vertekum/core';

/**
 * This file's location is the working directory: the token collection, the system-governed
 * \`.vertekum/\` dir, and export output all resolve relative to it.
 *
 * \`vertekum check\` works as-is: reference, resolver, and target validation are core builtins.
 * Output formats are extensions, and export targets are root config — e.g. with
 * \`@vertekum/ext-export-terrazzo\` (and a terrazzo plugin) installed:
 *
 *   extensions: [terrazzoExportExtension],
 *   targets: [
 *     { id: 'web', exporter: 'terrazzo', composition: 'default', out: 'build',
 *       options: { plugins: [css()] } },
 *   ],
 */
export default defineConfig({
  collection: './tokens',
});
`;

/** A seed DTCG set: enough for `check` and `build` to do real work, small enough to delete. */
export const SEED_SET = `${JSON.stringify(
  {
    color: {
      $type: 'color',
      base: { $value: '#1a1a1a' },
      surface: { $value: '{color.base}' },
    },
  },
  null,
  2,
)}\n`;

/** A resolver naming the seed set. No modifiers — compositions are added by hand. */
export const SEED_RESOLVER = `${JSON.stringify(
  {
    version: '2025.10',
    name: 'default',
    sets: { core: { sources: [{ $ref: 'core.json' }] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/core' }],
  },
  null,
  2,
)}\n`;

/**
 * The agent skill. It teaches the LOOP; `vertekum describe --json` supplies the FACTS. Anything
 * enumerable at runtime — exporters, commands, target options — is deliberately absent: duplicating
 * `describe` here would be stale the day after this file ships, which is the failure mode that
 * matters once Vertekum is installed in repos we do not control.
 *
 * Written as joined lines because the content contains fenced code blocks; a template literal would
 * need every backtick escaped.
 */
export const SKILL_TEMPLATE = [
  '---',
  'name: vertekum-tokens',
  'description: Use when creating, editing, or reviewing design tokens in a repo managed by Vertekum',
  '---',
  '',
  '# Working with Vertekum tokens',
  '',
  'Vertekum manages DTCG design tokens. **The files are the API.** You author token JSON directly',
  'with your normal editing tools; Vertekum resolves, validates, and builds output from them.',
  '',
  '## Orient yourself first',
  '',
  '```bash',
  'npx vertekum describe --json',
  '```',
  '',
  'This is the source of truth for what exists *here*: token sets, compositions, installed',
  'extensions, available exporters and their options, and every command you can run. Read it before',
  'assuming anything — never rely on a remembered list of exporters or commands.',
  '',
  '## The loop',
  '',
  '1. **Edit** token JSON under the collection directory (`describe` reports its path).',
  '2. **Check** — `npx vertekum check --json`. This is your compiler. It reports dangling aliases,',
  '   invalid compositions, and misconfigured export targets.',
  '3. **Build** — `npx vertekum build`. Writes the configured output targets.',
  '4. **Report** only after check passes with zero errors.',
  '',
  '## Rules',
  '',
  '- **Never hand-edit build output.** It is generated. Change the tokens and rebuild.',
  '- **Never rename a token by editing text.** Use `npx vertekum token rename <from> <to>` — it',
  '  rewrites every reference. Editing a path by hand leaves dangling aliases that `check` will',
  '  catch but that you will then have to undo.',
  '- **Renaming a whole group** needs `--allow-group`. That flag is a confirmation, not a',
  '  formality: it moves every token beneath the path.',
  '- **`--dry-run`** works on mutating commands. Use it when you are unsure what a change touches.',
  '- **Commit build output** along with the token change. The generated diff is what a human',
  '  reviews, and it is where the consequences of a token change become visible.',
  '- A reference looks like `{color.base}`. It must resolve to a token that exists in the same',
  '  composition.',
  '',
  '## When you are stuck',
  '',
  '`check` failing with something you do not understand is a signal to stop and ask, not to try',
  'variations. Token structure is a design decision, and a human owns it.',
  '',
].join('\n');
