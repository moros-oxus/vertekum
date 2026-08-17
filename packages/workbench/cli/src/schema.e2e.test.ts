import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

/**
 * A house vocabulary the fixture writes for itself: `color.text.[neutral|brand|success].[subtle|bold]`,
 * closed at every level.
 *
 * Written as a FILE rather than imported from a package, because that is now the only way a schema
 * exists — and it keeps this spec about the mechanism rather than about any particular package's
 * vocabulary. It composes its DTCG keys through `$ref`, which is why closure is
 * `unevaluatedProperties`: `additionalProperties` cannot see properties arriving through `allOf`.
 */
function houseSchema(closed: boolean): object {
  const close = closed ? { unevaluatedProperties: false } : {};
  const group = (properties: Record<string, object>) => ({
    type: 'object',
    allOf: [{ $ref: '#/$defs/groupKeys' }],
    properties,
    ...close,
  });
  const leaf = { $ref: '#/$defs/token' };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `test:house${closed ? '' : '-open'}`,
    $defs: {
      groupKeys: {
        properties: {
          $type: {},
          $description: {},
          $extensions: {},
          $deprecated: {},
        },
      },
      token: {
        type: 'object',
        allOf: [{ $ref: '#/$defs/groupKeys' }],
        properties: { $value: {} },
        ...close,
      },
    },
    ...group({
      color: group({
        text: group({
          neutral: group({ subtle: leaf, bold: leaf }),
          brand: group({ subtle: leaf, bold: leaf }),
          success: group({ subtle: leaf, bold: leaf }),
        }),
      }),
    }),
  };
}

/** Write a schema file and point the fixture's config at it. */
async function bindSchema(
  cwd: string,
  use: string,
  files: Record<string, object> = { 'house.json': houseSchema(true) },
): Promise<void> {
  await mkdir(join(cwd, 'schemas'), { recursive: true });
  for (const [name, schema] of Object.entries(files)) {
    await writeFile(
      join(cwd, 'schemas', name),
      `${JSON.stringify(schema, null, 2)}\n`,
    );
  }

  const file = join(cwd, 'vertekum.config.ts');
  const config = await readFile(file, 'utf8');
  await writeFile(
    file,
    config.replace(
      'extensions: [',
      `schemas: [{ from: './schemas', use: ${use} }],\n  extensions: [`,
    ),
  );
}

async function writeSet(
  cwd: string,
  name: string,
  tokens: object,
): Promise<void> {
  await writeFile(
    join(cwd, `tokens/${name}.json`),
    `${JSON.stringify(tokens, null, 2)}\n`,
  );
}

test('a token outside the vocabulary fails check, naming what was allowed', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(
    cwd,
    `{ 'house.json': { match: 'house.json', domain: 'house' } }`,
  );
  await writeSet(cwd, 'house', {
    color: {
      $type: 'color',
      text: { bland: { subtle: { $value: '#000' } } },
    },
  });

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);

  const result = JSON.parse(error.stdout);
  const diagnostic = result.diagnostics.find(
    (d: { code: string }) => d.code === 'house/unevaluatedProperties',
  );
  expect(diagnostic.file).toBe('house.json');
  expect(diagnostic.pointer).toBe('/color/text');
  expect(diagnostic.message).toContain("'bland'");
  expect(diagnostic.message).toContain('neutral');
}, 60_000);

test('a legal subset of the vocabulary passes', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(cwd, `{ 'house.json': 'house.json' }`);
  await writeSet(cwd, 'house', {
    color: {
      $type: 'color',
      text: { neutral: { subtle: { $value: '#000' } } },
    },
  });

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('a schema that cannot be read is reported, not read as no constraints', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(cwd, `{ 'does-not-exist.json': '*' }`);

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);

  const result = JSON.parse(error.stdout);
  const diagnostic = result.diagnostics.find(
    (d: { code: string }) => d.code === 'schema/unreadable',
  );
  expect(diagnostic.message).toContain('does-not-exist.json');
}, 60_000);

test('binding an open schema is refused rather than silently enforcing nothing', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(cwd, `{ 'open.json': '*' }`, {
    'open.json': houseSchema(false),
  });

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);

  const result = JSON.parse(error.stdout);
  const diagnostic = result.diagnostics.find(
    (d: { code: string }) => d.code === 'schema/no-op',
  );
  expect(diagnostic.message).toContain('constrains nothing');
}, 60_000);

test('a local schema may extend another by $ref', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(cwd, `{ 'extended.json': { match: 'house.json' } }`, {
    'open.json': houseSchema(false),
    // Composes the open vocabulary, adds one name, and closes the result itself — the whole point
    // of shipping open twins.
    'extended.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'test:extended',
      allOf: [{ $ref: './open.json' }],
      properties: {
        color: {
          properties: {
            text: { properties: { marketing: { type: 'object' } } },
          },
        },
      },
      unevaluatedProperties: false,
    },
  });
  await writeSet(cwd, 'house', {
    color: {
      $type: 'color',
      text: {
        neutral: { subtle: { $value: '#000' } },
        marketing: { $value: '#f80' },
      },
    },
  });

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('describe publishes what constrains the project, with resolved paths', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(
    cwd,
    `{ 'house.json': { match: 'house.json', domain: 'house' } }`,
  );

  const { stdout } = await run('node', [bin, 'describe', '--json'], { cwd });
  const info = JSON.parse(stdout);

  // The bundled DTCG bindings, then the configured one.
  expect(info.schemas.map((s: { id: string }) => s.id)).toEqual([
    'dtcg-resolver',
    'dtcg-tokens',
    null,
  ]);
  const house = info.schemas.at(-1);
  expect(house.match).toBe('house.json');
  expect(house.domain).toBe('house');
  // The path is what lets an agent open the schema and read the vocabulary for itself.
  expect(house.file.endsWith('schemas/house.json')).toBe(true);
}, 60_000);

test('a verb REFUSES to create a violation — check should never be how you find out', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(
    cwd,
    `{ 'house.json': { match: 'house.json', domain: 'house' } }`,
  );
  await writeSet(cwd, 'house', {
    color: {
      $type: 'color',
      text: { neutral: { subtle: { $value: '#000' } } },
    },
  });

  const error = await run(
    'node',
    [
      bin,
      'token',
      'add',
      'color.text.bland.subtle',
      '"#000"',
      '--type',
      'color',
      '--set',
      'house',
    ],
    { cwd },
  ).catch((e) => e);

  expect(error.code).toBe(1);
  expect(error.stderr).toContain('refused');
  expect(error.stderr).toContain("'bland' is not permitted");

  // Nothing was written: the file is exactly as it was.
  const house = JSON.parse(
    await readFile(join(cwd, 'tokens/house.json'), 'utf8'),
  );
  expect(Object.keys(house.color.text)).toEqual(['neutral']);

  // And the project is still clean.
  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('a pre-existing error does not block unrelated work', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(
    cwd,
    `{ 'house.json': { match: 'house.json', domain: 'house' } }`,
  );
  // Hand-authored: already illegal before any verb runs.
  await writeSet(cwd, 'house', { color: { text: { bland: {} } } });

  // A verb touching a different set must still work — refusing every command because the repo is
  // already dirty would make the tool unusable exactly when it is most needed. The token inherits
  // its type from the `color.gray` group: an inline `--type color` with a string value would be
  // refused by the base itself (2025.10 colours are object-notation wherever $type is inline).
  const { stdout } = await run(
    'node',
    [
      bin,
      'token',
      'add',
      'color.gray.300',
      '"#d1d5db"',
      '--set',
      'core',
      '--json',
    ],
    { cwd },
  );
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('group remove clears an illegal group a token verb cannot reach', async () => {
  const cwd = await exampleFixture('vtk-schema-');
  await bindSchema(
    cwd,
    `{ 'house.json': { match: 'house.json', domain: 'house' } }`,
  );
  await writeSet(cwd, 'house', {
    color: { text: { bland: { $type: 'color' } } },
  });

  await run(
    'node',
    [bin, 'group', 'remove', 'color.text.bland', '--set', 'house'],
    { cwd },
  );

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);
