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

for (const file of readdirSync(join(root, 'dfn')).sort()) {
  if (!file.endsWith('.dfn')) continue;
  const { content } = buildModule(join(root, 'dfn', file));
  const target = join(root, 'lib', file.replace(/\.dfn$/, '.json'));
  writeFileSync(target, content);
  process.stdout.write(`lib/${file.replace(/\.dfn$/, '.json')}\n`);
}
