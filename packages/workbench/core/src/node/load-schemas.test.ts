import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { validateFiles } from '../validate/schema';
import { loadSchemas } from './load-schemas';

const DIR = fileURLToPath(new URL('./__fixtures__', import.meta.url));

test('a local group resolves to a binding carrying its absolute path', async () => {
  const { bindings, diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'anonymous.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);
  expect(bindings).toHaveLength(1);
  expect(bindings[0]?.match).toBe('*');
  expect(bindings[0]?.target).toBe('tokens');
  expect(bindings[0]?.file?.endsWith('anonymous.json')).toBe(true);
});

test('a use-entry object overrides the group defaults', async () => {
  const { bindings } = await loadSchemas(
    [
      {
        from: './schemas',
        domain: 'house',
        severity: 'warning',
        use: {
          'anonymous.json': { match: 'core.json', severity: 'error', id: 'x' },
        },
      },
    ],
    { dir: DIR },
  );
  expect(bindings[0]).toMatchObject({
    match: 'core.json',
    domain: 'house',
    severity: 'error',
    id: 'x',
  });
});

test('a cross-file $ref is followed, and the composed schema validates', async () => {
  const { bindings, referenced, diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'extends-base.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);
  expect(referenced).toHaveLength(1);

  // `brand` comes from the base, `accent` from the extender, and nothing else is permitted.
  const ok = await validateFiles(
    { 'core.json': { color: { brand: {}, accent: {} } } },
    bindings,
    referenced,
  );
  expect(ok).toEqual([]);

  const bad = await validateFiles(
    { 'core.json': { color: {}, nonsense: {} } },
    bindings,
    referenced,
  );
  expect(bad.length).toBeGreaterThan(0);
});

test('a schema with no $id can still be a $ref target', async () => {
  // Its `$id` is synthesised from the resolved path, so composition needs no ceremony.
  const { bindings, diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'anonymous.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);
  expect(typeof (bindings[0]?.schema as { $id?: string }).$id).toBe('string');
});

test('binding a schema that constrains nothing is an error', async () => {
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'open.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.code).toBe('schema/no-op');
  expect(diagnostics[0]?.message).toContain('constrains nothing');
  expect(diagnostics[0]?.message).toContain('closed/');
});

test('a schema constraining values is NOT reported as a no-op', async () => {
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'values.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);
});

test('a remote $ref is refused, not fetched', async () => {
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'remote.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics.some((d) => d.code === 'schema/remote-ref')).toBe(true);
  expect(diagnostics[0]?.message).toContain('https://example.com/schema.json');
});

test('a missing file is a diagnostic, not a crash', async () => {
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'nope.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics.some((d) => d.code === 'schema/unreadable')).toBe(true);
});

test('an entry id matching a builtin replaces it rather than layering', async () => {
  const builtin = {
    id: 'dtcg-tokens',
    match: '*',
    target: 'tokens' as const,
    schema: { type: 'object' },
  };
  const { bindings } = await loadSchemas(
    [
      {
        from: './schemas',
        use: { 'anonymous.json': { match: '*', id: 'dtcg-tokens' } },
      },
    ],
    { dir: DIR, builtins: [builtin] },
  );
  expect(bindings).toHaveLength(1);
  expect(bindings[0]?.file?.endsWith('anonymous.json')).toBe(true);
});

test('builtins survive when nothing replaces them', async () => {
  const builtin = {
    id: 'dtcg-tokens',
    match: '*',
    target: 'tokens' as const,
    schema: { type: 'object' },
  };
  const { bindings } = await loadSchemas([], { dir: DIR, builtins: [builtin] });
  expect(bindings).toEqual([builtin]);
});

test('a $ref may name a SUBSCHEMA of another file, fragment and all', async () => {
  // Closing a nested level while extending requires re-referencing the base AT that level, so the
  // fragment has to survive the rewrite to the target's `$id`.
  const { bindings, referenced, diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'extends-deep.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);

  // `brand` comes from the base at that level, `accent` from the extender.
  const ok = await validateFiles(
    { 'core.json': { color: { brand: {}, accent: {} } } },
    bindings,
    referenced,
  );
  expect(ok).toEqual([]);

  // And the nested level really is closed — which root-level closure alone does NOT achieve.
  const bad = await validateFiles(
    { 'core.json': { color: { invented: {} } } },
    bindings,
    referenced,
  );
  expect(bad).toHaveLength(1);
  expect(bad[0]?.pointer).toBe('/color');
});

test('a vocabulary composing a DENOTATIONS file: unions work, messages keep the names', async () => {
  // The grammar model's file split: denotations in their own file, referenced relatively. The
  // loader resolves the ref file-relatively and registers the file by $id; the same ref also
  // resolves by plain URI resolution because the $ids share a directory.
  const { bindings, referenced, diagnostics } = await loadSchemas(
    [
      {
        from: './schemas',
        domain: 'vocabulary',
        use: { 'grammar-vocabulary.json': '*' },
      },
    ],
    { dir: DIR },
  );
  expect(diagnostics).toEqual([]);

  const ok = await validateFiles(
    {
      'core.json': {
        color: {
          text: { subtle: { $value: '#0' }, brand: { bold: { $value: '#1' } } },
        },
      },
    },
    bindings,
    referenced,
  );
  expect(ok).toEqual([]);

  const bad = await validateFiles(
    { 'core.json': { color: { text: { bland: { $value: '#0' } } } } },
    bindings,
    referenced,
  );
  expect(bad).toHaveLength(1);
  expect(bad[0]?.pointer).toBe('/color/text');
  expect(bad[0]?.message).toContain("'bland' is not permitted");
});

test('a 2020-12 keyword in a draft-07 schema is an error, not silent under-enforcement', async () => {
  // A validator ignores keywords its dialect does not define, so this schema's seal would
  // silently not seal — the same failure class schema/no-op exists for, invisible to it because
  // the keyword IS present.
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'mismatched.json': '*' } }],
    { dir: DIR },
  );
  const mismatch = diagnostics.find(
    (d) => d.code === 'schema/dialect-mismatch',
  );
  expect(mismatch).toBeDefined();
  expect(mismatch?.message).toContain('unevaluatedProperties');
  expect(mismatch?.message).toContain('draft-07');
});

test('an http(s) ref satisfied by an $id IN the document is not "remote"', async () => {
  // The published DTCG schema is exactly this shape: absolute refs resolved against its own
  // inlined, $id-carrying definitions. Nothing needs fetching, so nothing may be refused.
  const { bindings, diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'self-contained.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics.filter((d) => d.code === 'schema/remote-ref')).toEqual([]);
  expect(bindings).toHaveLength(1);
});

test('an http(s) ref satisfiable by NOTHING loaded is still refused', async () => {
  const { diagnostics } = await loadSchemas(
    [{ from: './schemas', use: { 'remote.json': '*' } }],
    { dir: DIR },
  );
  expect(diagnostics.some((d) => d.code === 'schema/remote-ref')).toBe(true);
});
