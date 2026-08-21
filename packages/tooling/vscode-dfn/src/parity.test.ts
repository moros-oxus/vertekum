import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, '../../schemas/builder/grammar');

test('bundled grammar copies match their source — else run `pnpm --filter vertekum-dfn sync`', () => {
  for (const file of [
    'dfn.tmLanguage.json',
    'dfn.language-configuration.json',
  ]) {
    expect(readFileSync(join(root, 'syntaxes', file), 'utf8')).toBe(
      readFileSync(join(source, file), 'utf8'),
    );
  }
});
