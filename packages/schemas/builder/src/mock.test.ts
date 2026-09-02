import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { build } from './build';
import {
  breakTokens,
  fullPaths,
  leastPaths,
  mockTokens,
  renderNames,
  renderTokens,
  rng,
  typeResolver,
} from './mock';
import { resolveModule } from './resolve';

function tree(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-mock-'));
  writeFileSync(join(dir, 'm.dfn'), source);
  return build(resolveModule(join(dir, 'm.dfn')));
}

const BRANCHY = [
  'scope "document"',
  'role = [text | background | border]',
  'emphasis = [subtle | bold]',
  'state = [hovered | pressed]',
  'root = color.<role>.<emphasis>?.<state>?',
].join('\n');

test('least covers every adjacency with far fewer rows than full', () => {
  const node = tree(BRANCHY);
  const full = fullPaths(node);
  const least = leastPaths(node);
  // Token names are LEAVES — an interior name (optional tail skipped) is a group, never a
  // token (that is what $root exists for). 3 roles × (2 emphasis × 2 states + 2 direct states).
  expect(full).toHaveLength(18);
  expect(least.length).toBeLessThan(full.length);

  // On a wide matrix the gap is the point: 12 roles × 12 emphases × 12 states.
  const wide = tree(
    [
      'scope "document"',
      `role = [${Array.from({ length: 12 }, (_, i) => `r${i}`).join(' | ')}]`,
      `emphasis = [${Array.from({ length: 12 }, (_, i) => `e${i}`).join(' | ')}]`,
      `state = [${Array.from({ length: 12 }, (_, i) => `s${i}`).join(' | ')}]`,
      'root = color.<role>.<emphasis>.<state>',
    ].join('\n'),
  );
  expect(fullPaths(wide)).toHaveLength(12 * 12 * 12);
  expect(leastPaths(wide).length).toBeLessThan((12 * 12 * 12) / 5);

  // Every parent→child adjacency of the full walk appears somewhere in least.
  const adjacencies = (paths: string[][]) => {
    const out = new Set<string>();
    for (const path of paths) {
      let parent = '';
      for (const name of path) {
        out.add(`${parent}>${name}`);
        parent = name;
      }
    }
    return out;
  };
  const covered = adjacencies(least);
  for (const pair of adjacencies(full)) expect(covered.has(pair)).toBe(true);
});

test('mocks are deterministic and typed by glob map, then fallback', () => {
  const node = tree(BRANCHY);
  const typeOf = typeResolver({ 'color.*': 'color' }, 'number');
  const tokens = mockTokens(leastPaths(node), typeOf);
  expect(tokens.every((t) => t.type === 'color')).toBe(true);
  expect(typeResolver(undefined, undefined)('anything')).toBe('color');
  expect(typeResolver({ 'space.*': 'dimension' }, 'number')('color.x')).toBe(
    'number',
  );

  const a = breakTokens(tokens, 0.5, rng(7));
  const b = breakTokens(tokens, 0.5, rng(7));
  expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // seeded → diff-stable
  expect(breakTokens(tokens, 0, rng(1)).every((t) => !t.broken)).toBe(true);
  const broken = breakTokens(tokens, 1, rng(1));
  expect(broken.every((t) => t.broken === 'name' || t.broken === 'value')).toBe(
    true,
  );
});

test('renderers: grouped names markdown and nested DTCG with break markers', () => {
  const node = tree(BRANCHY);
  const paths = leastPaths(node);
  const md = renderNames('m', 'least', paths);
  expect(md).toContain('# m — granted names (least)');
  expect(md).toContain('## color (');

  const tokens = breakTokens(
    mockTokens(paths, typeResolver(undefined, undefined)),
    1,
    rng(3),
  );
  const doc = JSON.parse(renderTokens(tokens));
  const text = JSON.stringify(doc);
  expect(text).toContain('deliberately broken');
  expect(text).toContain('"$type":"color"');
});
