import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import {
  asFailure,
  bin,
  exampleFixture,
  unexpectedSuccess,
} from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-ramp-', 'extensions');

test('a virtual ramp exports, takes an override, commits via ramp build, and --check guards it', async () => {
  const cwd = await fixture();
  const { writeFile } = await import('node:fs/promises');
  const corePath = join(cwd, 'tokens/core.json');
  const cssLine = async (name: string) => {
    await run('node', [bin, 'build'], { cwd });
    const css = await readFile(join(cwd, 'build/css/tokens.css'), 'utf8');
    return css.match(new RegExp(`--${name}: [^;]+;`))?.[0];
  };

  // Virtual: generated stops reach the css output; the anchor step aliases the anchor it was
  // authored as (`{brand.accent}`), so the link survives into every output.
  // The group's own $root token exports beside them (the consumer field report: a $root-bearing
  // ramp group must generate, not silently decline).
  await run('node', [bin, 'build'], { cwd });
  const css = await readFile(join(cwd, 'build/css/tokens.css'), 'utf8');
  expect(css).toMatch(/--color-teal: oklch/);
  expect(css).toMatch(/--color-teal-100: oklch/);
  expect(css).toMatch(/--color-teal-300: var\(--brand-accent\)/);
  const generated200 = await cssLine('color-teal-200');
  const generated100 = await cssLine('color-teal-100');

  // --dry-run --json emits the computed stops — a value source that needs no CSS parsing.
  const probe = await run(
    'node',
    [bin, 'ramp', 'build', '--dry-run', '--json'],
    { cwd },
  );
  const ramps = JSON.parse(probe.stdout).data.ramps;
  expect(ramps).toHaveLength(1);
  expect(ramps[0].path).toBe('color.teal');
  expect(ramps[0].committed).toBe(false);
  expect(ramps[0].overridden).toEqual([]);
  expect(ramps[0].stops['300']).toBe('{brand.accent}');

  // Generation first, authored wins: `token set` on a generated stop writes an override, and
  // every other stop keeps generating (the field report: one authored stop used to erase nine).
  const set = await run(
    'node',
    [bin, 'token', 'set', 'color.teal.200', '#ff0000'],
    { cwd },
  );
  expect(set.stdout).toContain('overrode color.teal.200');
  expect(await cssLine('color-teal-200')).not.toBe(generated200);
  expect(await cssLine('color-teal-100')).toBe(generated100);
  const check = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(check.stdout).ok).toBe(true);

  // Removing the override brings the generated stop back.
  await run('node', [bin, 'token', 'remove', 'color.teal.200'], { cwd });
  expect(await cssLine('color-teal-200')).toBe(generated200);

  // The other verbs still refuse a generated stop, and say what to do instead.
  const refused = await run(
    'node',
    [bin, 'token', 'remove', 'color.teal.200'],
    { cwd },
  ).then(unexpectedSuccess, asFailure);
  expect(refused.code).toBe(1);
  expect(refused.stderr).toContain("'token set' it to override");

  // Committed: the stops become real tokens, marked; an override survives the build unmarked.
  await run('node', [bin, 'token', 'set', 'color.teal.200', '#ff0000'], {
    cwd,
  });
  const built = await run('node', [bin, 'ramp', 'build'], { cwd });
  expect(built.stdout).toContain('1 override(s) kept');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  const teal = core.color.teal;
  expect(teal['300'].$value).toBe('{brand.accent}');
  expect(teal['300'].$extensions['org.vertekum.generate/ramp']).toBe(
    'committed',
  );
  expect(teal['200'].$extensions).toBeUndefined();
  expect(Object.keys(teal).filter((k) => !k.startsWith('$'))).toHaveLength(5);
  const committedCheck = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(committedCheck.stdout).ok).toBe(true);

  // Fresh; then a hand-edited committed stop is stale — the override never is.
  const fresh = await run('node', [bin, 'ramp', 'build', '--check'], { cwd });
  expect(fresh.stdout).toContain('1 committed ramp(s) fresh');
  teal['500'].$value.hex = '#000000';
  await writeFile(corePath, JSON.stringify(core, null, 2));
  const stale = await run('node', [bin, 'ramp', 'build', '--check'], {
    cwd,
  }).then(unexpectedSuccess, asFailure);
  expect(stale.code).toBe(1);
  expect(stale.stderr).toContain('stale ramp stop(s): color.teal.500 —');
}, 180_000);

test('a child naming no step warns in check; a malformed committed mark is an error', async () => {
  const cwd = await fixture();
  const corePath = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  const stop = {
    $type: 'color',
    $value: { colorSpace: 'srgb', components: [1, 0, 0], alpha: 1 },
  };
  core.color.teal['30'] = stop;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(corePath, JSON.stringify(core, null, 2));

  const warned = await run('node', [bin, 'check', '--json'], { cwd });
  const report = JSON.parse(warned.stdout);
  expect(report.ok).toBe(true);
  expect(report.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'ramp/unknown-stop',
      severity: 'warning',
    }),
  );

  core.color.teal['500'] = {
    ...stop,
    $extensions: { 'org.vertekum.generate/ramp': 'nope' },
  };
  await writeFile(corePath, JSON.stringify(core, null, 2));
  const refused = await run('node', [bin, 'check', '--json'], { cwd }).then(
    unexpectedSuccess,
    asFailure,
  );
  expect(refused.code).toBe(1);
  expect(
    JSON.parse(refused.stdout).diagnostics.some(
      (d: { code: string; severity: string }) =>
        d.code.startsWith('ramp/') && d.severity === 'error',
    ),
  ).toBe(true);
}, 60_000);

test('an unresolvable anchor is loud in check', async () => {
  const cwd = await fixture();
  const corePath = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  core.color.teal.$extensions['org.vertekum.generate/ramp'].anchor =
    '{brand.nope}';
  const { writeFile } = await import('node:fs/promises');
  await writeFile(corePath, JSON.stringify(core, null, 2));

  const refused = await run('node', [bin, 'check', '--json'], { cwd }).then(
    unexpectedSuccess,
    asFailure,
  );
  expect(refused.code).toBe(1);
  const report = JSON.parse(refused.stdout);
  expect(
    report.diagnostics.some(
      (d: { code: string }) => d.code === 'ramp/unresolved-anchor',
    ),
  ).toBe(true);
}, 60_000);

test('sets live in subdirectories: read, created by verb, removed with their dir', async () => {
  const cwd = await fixture();

  // The shipped nested set is read and exported like any other.
  const described = await run('node', [bin, 'describe', '--json'], { cwd });
  expect(JSON.parse(described.stdout).project.sets).toContain('brands/print');

  await run('node', [bin, 'set', 'add', 'brands/extra'], { cwd });
  await run(
    'node',
    [
      bin,
      'token',
      'add',
      'x.y',
      '4px',
      '--type',
      'dimension',
      '--set',
      'brands/extra',
    ],
    { cwd },
  );
  const file = join(cwd, 'tokens/brands/extra.json');
  expect(JSON.parse(await readFile(file, 'utf8')).x.y.$value).toEqual({
    value: 4,
    unit: 'px',
  });

  await run('node', [bin, 'set', 'remove', 'brands/extra', '--force'], { cwd });
  const check = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(check.stdout).ok).toBe(true);
}, 120_000);

test('an unknown profile is loud in check', async () => {
  const cwd = await fixture();
  const corePath = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  core.color.teal.$extensions['org.vertekum.generate/ramp'].profile = 'nope';
  const { writeFile } = await import('node:fs/promises');
  await writeFile(corePath, JSON.stringify(core, null, 2));

  const refused = await run('node', [bin, 'check', '--json'], { cwd }).then(
    unexpectedSuccess,
    asFailure,
  );
  expect(refused.code).toBe(1);
  const report = JSON.parse(refused.stdout);
  const found = report.diagnostics.find(
    (d: { code: string }) => d.code === 'ramp/unknown-profile',
  );
  expect(found?.message).toContain("unknown profile 'nope'");
}, 60_000);
