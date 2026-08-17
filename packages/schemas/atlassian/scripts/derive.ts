import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSchema } from '../src/build-schema';

/**
 * Derive the Atlassian vocabulary from `@atlaskit/tokens`.
 *
 * The committed artifact is the NAME LIST, not the built schema. Its job is review: an Atlaskit
 * upgrade should show a maintainer exactly which names appeared and disappeared, and a sorted list
 * diffs as added and removed lines. A nested-schema diff buries the same fact in restructured
 * braces, and would have to be emitted twice (closed and open) — reintroducing the drift that
 * building both from one source exists to prevent.
 *
 * Run: pnpm --filter @vertekum/schema-atlassian derive
 */

const require = createRequire(import.meta.url);

/**
 * The authoritative machine-readable list. The package's `figma/*.json` exports are incomplete —
 * 505 names, missing `motion` entirely and most of `font`. The docs site is prose.
 */
const artifact = require('@atlaskit/tokens/dist/cjs/artifacts/token-names.js');
const { version } = require('@atlaskit/tokens/package.json');

/**
 * Names deliberately excluded, one entry per rationale so a future maintainer who disagrees can
 * delete a single line. This is an EDIT to an otherwise faithful transcription, which is exactly
 * why it is data with reasons attached rather than a filter buried in a loop.
 */
const DROPPED: Array<{ prefix: string; why: string }> = [
  {
    prefix: 'color.rovo.',
    why: "Rovo is Atlassian's AI product surface, not a general vocabulary",
  },
  { prefix: 'elevation.rovo.', why: 'as above' },
  {
    prefix: 'utility.UNSAFE.',
    why: 'a declared escape hatch; a vocabulary should not bless one',
  },
];

const all = Object.keys(artifact.default ?? artifact).sort();
const names = all.filter((n) => !DROPPED.some((d) => n.startsWith(d.prefix)));

/**
 * Atlassian's flat naming lets a name be both a token and an ancestor — `color.text` is the default
 * text colour while `color.text.subtle` is a variant of it. DTCG forbids a node that is both, and
 * 2025.10 answers it with the reserved token name `$root`, which is included in the path.
 */
const encoded = names
  .map((n) =>
    names.some((other) => other.startsWith(`${n}.`)) ? `${n}.$root` : n,
  )
  .sort();

const out = {
  source: '@atlaskit/tokens',
  version,
  dropped: DROPPED.map((d) => `${d.prefix}* — ${d.why}`),
  names: encoded,
};

const target = fileURLToPath(
  new URL('../src/vocabulary.json', import.meta.url),
);
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${encoded.length} names -> src/vocabulary.json`);

/**
 * Project the name list into schema files — one variant each.
 *
 * `vocabulary.json` stays the reviewed artifact — a sorted list that diffs as lines. These are
 * mechanical projections of it, which is why they are generated rather than authored: an aspect is
 * just the subset of names under one top-level branch.
 *
 * An ASPECT seals its own branch and leaves the root open, so several can be bound together
 * without each reporting the others' branches as illegal; the WHOLESALE schema seals the root
 * too, for a project adopting the system entire. To modify any of them: eject the file and edit —
 * the copy is ordinary source.
 */
const branches = [...new Set(encoded.map((name) => name.split('.')[0]))].sort();

for (const branch of [...branches, undefined]) {
  const file = `${branch ?? 'atlassian'}.json`;
  const schema = buildSchema(encoded, { branch });
  writeFileSync(
    fileURLToPath(new URL(`../${file}`, import.meta.url)),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
  const count = branch
    ? encoded.filter((n) => n.split('.')[0] === branch).length
    : encoded.length;
  console.log(`  ${file}`.padEnd(20), `${count} names`);
}
