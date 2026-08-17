import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Refresh the base from the canonical URL. The base ships BYTE-VERBATIM — there is no transform
 * and no source/output split — so this overwrites `format.json` itself, and the git diff of that
 * file is the whole review artifact for an upstream revision.
 *
 * Run: pnpm --filter @vertekum/schema-dtcg fetch
 */
const URL = 'https://www.designtokens.org/schemas/2025.10/format.json';

const response = await fetch(URL);
if (!response.ok) throw new Error(`${URL} -> HTTP ${response.status}`);
const body = await response.text();

writeFileSync(fileURLToPath(new URL('../format.json', import.meta.url)), body);
console.log(`${body.length} bytes -> format.json`);
