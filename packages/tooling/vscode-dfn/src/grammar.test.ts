import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { INITIAL, parseRawGrammar, Registry } from 'vscode-textmate';

/**
 * Tokenization smoke test: the grammar's SCOPES over a sample using every construct — a
 * behavioral pin, not a JSON-validity check. Assertions stick to stable scope names.
 */

const here = dirname(fileURLToPath(import.meta.url));
const grammarPath = join(here, '../syntaxes/dfn.tmLanguage.json');
const require = createRequire(import.meta.url);

async function grammar() {
  const wasm = readFileSync(
    join(dirname(require.resolve('vscode-oniguruma')), 'onig.wasm'),
  );
  await loadWASM(wasm.buffer as ArrayBuffer);
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
      createOnigString: (s: string) => new OnigString(s),
    }),
    loadGrammar: async () =>
      parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath),
  });
  const loaded = await registry.loadGrammar('source.dfn');
  if (!loaded) throw new Error('grammar failed to load');
  return loaded;
}

function scopesFor(
  tokens: Array<{ startIndex: number; endIndex: number; scopes: string[] }>,
  line: string,
  text: string,
): string[] {
  const at = line.indexOf(text);
  const token = tokens.find((t) => t.startIndex <= at && at < t.endIndex);
  return token?.scopes ?? [];
}

test('the sample module tokenizes with the expected scopes', async () => {
  const g = await grammar();
  const lines = [
    '# a comment',
    'scope "branch"',
    'use "./colors.dfn"',
    'emphasis = subtle | bold',
    'root = color.<@colors/role ![brand]>.<emphasis>?.100-900/100',
    '  | fallback.[a | b *]',
  ];
  let state = INITIAL;
  const perLine = lines.map((line) => {
    const r = g.tokenizeLine(line, state);
    state = r.ruleStack;
    return r.tokens;
  });

  expect(scopesFor(perLine[0], lines[0], '# a comment')).toContain(
    'comment.line.number-sign.dfn',
  );
  expect(scopesFor(perLine[1], lines[1], 'scope')).toContain(
    'keyword.other.pragma.dfn',
  );
  expect(scopesFor(perLine[1], lines[1], '"branch"')).toContain(
    'string.quoted.double.dfn',
  );
  expect(scopesFor(perLine[2], lines[2], 'use')).toContain(
    'keyword.control.import.dfn',
  );
  expect(scopesFor(perLine[3], lines[3], 'emphasis')).toContain(
    'entity.name.function.production.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], 'root')).toContain(
    'keyword.control.root.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], 'colors/')).toContain(
    'entity.name.namespace.module.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], 'role')).toContain(
    'variable.other.reference.imported.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], 'emphasis')).toContain(
    'variable.other.reference.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], '!')).toContain(
    'keyword.operator.omit.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], 'brand')).toContain(
    'variable.parameter.member.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], '?')).toContain(
    'keyword.operator.optional.dfn',
  );
  expect(scopesFor(perLine[4], lines[4], '100-900/100')).toContain(
    'constant.numeric.range.dfn',
  );
  expect(scopesFor(perLine[5], lines[5], '|')).toContain(
    'keyword.operator.dfn',
  );
  expect(scopesFor(perLine[5], lines[5], '*')).toContain(
    'keyword.operator.open-set.dfn',
  );
});
