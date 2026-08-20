import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModule } from '@vertekum/schema-builder/api';
import { expect, test } from 'vitest';
import atlassian from '../lib/atlassian.json';
import color from '../lib/color.json';
import space from '../lib/space.json';
import vocabulary from './vocabulary.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const aspectFiles = readdirSync(join(root, 'lib'))
  .filter((f) => f.endsWith('.json') && f !== 'atlassian.json')
  .sort();

async function ajv() {
  const { default: Ajv } = await import('ajv/dist/2020.js');
  return new Ajv({ allErrors: true, strict: false });
}

/** Every dotted name a schema grants, following `$defs` refs. */
function granted(schema: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  const defs = (schema.$defs ?? {}) as Record<string, unknown>;
  const walk = (node: unknown, prefix: string): void => {
    let position = node as Record<string, unknown>;
    if (typeof position.$ref === 'string') {
      position = defs[position.$ref.split('/').pop() as string] as Record<
        string,
        unknown
      >;
    }
    for (const [name, child] of Object.entries(
      (position.properties ?? {}) as Record<string, unknown>,
    )) {
      const path = prefix ? `${prefix}.${name}` : name;
      names.add(path);
      walk(child, path);
    }
  };
  walk(schema, '');
  return names;
}

/**
 * The generative aspects grant the system's GRAMMAR, of which the shipped names are one
 * instantiation — so parity is shipped ⊆ granted, with the grantable-but-unshipped surplus
 * pinned to an exact per-aspect count. A surplus change means the grammar changed: review it,
 * then update the number deliberately. Corpus-shaped aspects grant exactly what ships.
 */
const EXPECTED_SURPLUS: Record<string, number> = {
  border: 0,
  color: 1580,
  elevation: 2,
  font: 0,
  motion: 1,
  opacity: 0,
  radius: 0,
  space: 0,
  utility: 0,
};

test('every shipped name is granted; the generative surplus is the pinned count', () => {
  const union = new Set<string>();
  const shipped = new Set(
    vocabulary.names.map((n: string) =>
      n
        .split('.')
        .filter((s) => s !== '$root')
        .join('.'),
    ),
  );
  for (const file of aspectFiles) {
    const aspect = file.replace(/\.json$/, '');
    const names = granted(
      JSON.parse(readFileSync(join(root, 'lib', file), 'utf8')),
    );
    for (const name of names) union.add(name);

    const shippedHere = [...shipped].filter((n) => n.split('.')[0] === aspect);
    for (const name of shippedHere) {
      expect(names, `'${name}' ships but is not granted`).toContain(name);
    }
    // Surplus counts granted positions that neither ship nor lead to a shipped name.
    const surplus = [...names].filter(
      (n) => !shipped.has(n) && !shippedHere.some((s) => s.startsWith(`${n}.`)),
    );
    expect(surplus.length, `${aspect} surplus drifted`).toBe(
      EXPECTED_SURPLUS[aspect],
    );
  }
  expect(granted(atlassian as Record<string, unknown>)).toEqual(union);
});

test('the committed artifacts are current: rebuilding every module reproduces them', () => {
  for (const file of readdirSync(join(root, 'dfn')).sort()) {
    if (!file.endsWith('.dfn')) continue;
    const { content } = buildModule(join(root, 'dfn', file));
    const committed = readFileSync(
      join(root, 'lib', file.replace(/\.dfn$/, '.json')),
      'utf8',
    );
    expect(committed, `${file} is stale — run pnpm build`).toBe(content);
  }
});

test('every shipped schema compiles under 2020-12', async () => {
  const instance = await ajv();
  for (const schema of [color, space, atlassian]) {
    expect(() => instance.compile(schema)).not.toThrow();
  }
});

test('the shipped color aspect enforces names and order, not representation', async () => {
  const instance = await ajv();
  const validate = instance.compile(color);

  expect(
    validate({
      color: {
        $type: 'color',
        text: { $root: { $value: '#172B4D' }, subtle: { $value: '#44546F' } },
      },
    }),
  ).toBe(true);
  // representation freedom at a granted name
  expect(validate({ color: { text: { accent: { $value: '#0' } } } })).toBe(
    true,
  );
  // names remain the law
  expect(validate({ color: { text: { bland: { $value: '#0' } } } })).toBe(
    false,
  );
  expect(
    validate({ color: { text: { subtle: { deeper: { $value: '#0' } } } } }),
  ).toBe(false);
  // another aspect's branch passes untouched
  expect(validate({ space: { 100: { $value: '8px' } } })).toBe(true);
});

test('two aspects bound together produce no cross-aspect false errors', async () => {
  const instance = await ajv();
  const colorValidate = instance.compile(color);
  const spaceValidate = instance.compile(space);
  const doc = {
    color: { text: { subtle: { $value: '#333' } } },
    space: { 100: { $value: '8px' } },
  };
  expect(colorValidate(doc)).toBe(true);
  expect(spaceValidate(doc)).toBe(true);
});

test('the wholesale schema seals the root', async () => {
  const instance = await ajv();
  const validate = instance.compile(atlassian);
  expect(validate({ nonsense: { x: { $value: 1 } } })).toBe(false);
});
