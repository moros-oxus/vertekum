import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { keyOrder, stringifyOrdered } from './json-order';

const at = (...path: string[]) => path.join('\u0000');

test('keyOrder records each object’s keys in source order, arrays and escapes included', () => {
  const order = keyOrder(
    '{ "b": 1, "a": { "050": 1, "100": 2 }, "c": [ { "z": 1, "y": [] } ], "q\\"x": "}" }',
  );
  expect(order.get(at())).toEqual(['b', 'a', 'c', 'q"x']);
  expect(order.get(at('a'))).toEqual(['050', '100']);
  expect(order.get(at('c', '0'))).toEqual(['z', 'y']);
});

test('without a template, the output is exactly JSON.stringify’s', () => {
  const value = {
    n: null,
    t: true,
    num: 1.5,
    s: 'é "q" \n',
    arr: [1, [2, {}], [], { k: 'v' }],
    obj: { inner: { deep: [null] }, empty: {} },
    skip: undefined,
  };
  for (const indent of [2, 4, '\t']) {
    expect(stringifyOrdered(value, new Map(), indent)).toBe(
      JSON.stringify(value, null, indent),
    );
  }
});

test('a template keeps "050" before "100" — the order a plain object loses — and new keys follow', () => {
  const text = `{
  "motion": {
    "duration": {
      "050": {
        "$type": "duration",
        "$value": 50
      },
      "100": {
        "$type": "duration",
        "$value": 100
      }
    }
  }
}`;
  const parsed = JSON.parse(text);
  // A plain object has already moved "050" after "100".
  expect(Object.keys(parsed.motion.duration)).toEqual(['100', '050']);
  expect(stringifyOrdered(parsed, keyOrder(text), 2)).toBe(text);

  parsed.motion.duration['200'] = { $type: 'duration', $value: 200 };
  parsed.motion.easing = 'linear';
  const out = stringifyOrdered(parsed, keyOrder(text), 2);
  expect(out.indexOf('"050"')).toBeLessThan(out.indexOf('"100"'));
  expect(out.indexOf('"100"')).toBeLessThan(out.indexOf('"200"'));
  expect(out.indexOf('"duration"')).toBeLessThan(out.indexOf('"easing"'));
});

test('every example token file the old writer reproduced byte for byte, this one does too', async () => {
  const root = join(__dirname, '../../../../../examples');
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json') && path.includes('/tokens/')) {
        files.push(path);
      }
    }
  };
  await walk(root);
  let stable = 0;
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const parsed = JSON.parse(text);
    if (`${JSON.stringify(parsed, null, 2)}\n` !== text) continue;
    stable++;
    expect(`${stringifyOrdered(parsed, keyOrder(text), 2)}\n`, file).toBe(text);
  }
  expect(stable).toBeGreaterThan(0);
});
