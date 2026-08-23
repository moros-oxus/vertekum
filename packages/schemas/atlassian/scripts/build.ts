import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModule } from '@vertekum/schema-builder/api';

/**
 * Build every definition module in `dfn/` into its JSON Schema artifact in `lib/` — the
 * source/artifact split this package ships (`dfn/` in, `lib/` out; the exports map keeps
 * consumer specifiers flat). Run: pnpm --filter @vertekum/schema-atlassian build
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'lib'), { recursive: true });

const modules = readdirSync(join(root, 'dfn'), {
  recursive: true,
  encoding: 'utf8',
})
  .filter((f) => f.endsWith('.dfn'))
  .sort();
for (const file of modules) {
  const { content } = buildModule(join(root, 'dfn', file), { label: file });
  const target = join(root, 'lib', file.replace(/\.dfn$/, '.json'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  process.stdout.write(`lib/${file.replace(/\.dfn$/, '.json')}\n`);
}
