// Copy the grammar files from their single source (@vertekum/schema-builder) into this
// extension: vsce bundles only files inside the extension directory. The parity spec fails
// when the copies drift — rerun `pnpm --filter vertekum-dfn sync` after grammar edits.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '../../../schemas/builder/grammar');
const target = join(here, '../syntaxes');

mkdirSync(target, { recursive: true });
for (const file of ['dfn.tmLanguage.json', 'dfn.language-configuration.json']) {
  copyFileSync(join(source, file), join(target, file));
  process.stdout.write(`synced ${file}\n`);
}
