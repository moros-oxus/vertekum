import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

const KEY = 'org.test.type';

/**
 * The fixture's config: the unabridged example with an INLINE extension registering a textCase
 * codec and its payload-validating schema binding — the whole extension-held-token-data seam
 * driven from a consumer config, exactly how consumer will use it.
 */
const CONFIG = `
import { defineConfig, SCHEMA_BINDING_SERVICE, TOKEN_CODEC_SERVICE } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';
import { tokensExtension } from '@vertekum/ext-tokens';

const KEY = '${KEY}';

const PAYLOAD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $defs: {
    node: {
      anyOf: [
        { not: { type: 'object' } },
        {
          type: 'object',
          properties: {
            $extensions: {
              type: 'object',
              properties: {
                [KEY]: {
                  type: 'object',
                  required: ['$type', '$value'],
                  properties: {
                    $type: { const: 'textCase' },
                    $value: { enum: ['none', 'uppercase', 'lowercase', 'capitalize'] },
                  },
                },
              },
            },
          },
          additionalProperties: { $ref: '#/$defs/node' },
        },
      ],
    },
  },
  $ref: '#/$defs/node',
};

const textTypes = {
  manifest: { id: 'test.text-types', name: 'Text types' },
  activate(ctx: any) {
    ctx.services.get(TOKEN_CODEC_SERVICE).register({
      key: KEY,
      materialize(payload: any) {
        if (!payload || typeof payload !== 'object' || typeof payload.$type !== 'string') {
          return null;
        }
        return { type: payload.$type, value: payload.$value };
      },
      serialize(token: any) {
        return { $type: token.type, $value: token.value };
      },
    });
    ctx.services.get(SCHEMA_BINDING_SERVICE).register({
      match: '*',
      target: 'tokens',
      domain: 'texttype',
      schema: PAYLOAD_SCHEMA,
    });
  },
};

export default defineConfig({
  collection: './tokens',
  targets: [{ id: 'web', exporter: 'css', composition: 'default', out: 'build/css' }],
  extensions: [cssExportExtension, tokensExtension, textTypes],
});
`;

async function fixture(payloadValue: string): Promise<string> {
  const cwd = await exampleFixture('vtk-codec-');
  await writeFile(join(cwd, 'vertekum.config.ts'), CONFIG);
  const corePath = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  core.font = {
    case: {
      upper: {
        $extensions: { [KEY]: { $type: 'textCase', $value: payloadValue } },
      },
    },
  };
  await writeFile(corePath, JSON.stringify(core, null, 2));
  return cwd;
}

test('a carrier token checks clean, edits through its codec, and exports', async () => {
  const cwd = await fixture('uppercase');

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);

  // The verb sees the materialized token; the write goes back through the codec.
  await run('node', [bin, 'token', 'set', 'font.case.upper', 'lowercase'], {
    cwd,
  });
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  expect(core.font.case.upper).toEqual({
    $extensions: { [KEY]: { $type: 'textCase', $value: 'lowercase' } },
  });

  // The css exporter reads the materialized model — the custom-typed token reaches the output.
  await run('node', [bin, 'build'], { cwd });
  const css = await readFile(join(cwd, 'build/css/tokens.css'), 'utf8');
  expect(css).toMatch(/font-case-upper:\s*lowercase/);
}, 120_000);

test('a malformed payload is the extension binding’s diagnostic, exit 1', async () => {
  const cwd = await fixture('shouty');
  const refused = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (error: { code: number; stdout: string }) => error,
  );
  expect(refused.code).toBe(1);
  const report = JSON.parse(refused.stdout);
  expect(
    report.diagnostics.some((d: { code: string }) =>
      d.code.startsWith('texttype/'),
    ),
  ).toBe(true);
}, 120_000);
