import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { exampleFixture } from '../e2e-fixture';
import { loadProject } from '../loadProject';
import { runBatch } from './batch';

/** Captures what the batch prints, for the assertions below. */
function capture() {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    err.push(String(chunk));
    return true;
  });
  return { out: () => out.join(''), err: () => err.join('') };
}
afterEach(() => vi.restoreAllMocks());

/** Every token file's text, to prove a refused batch wrote nothing. */
async function snapshot(cwd: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(join(cwd, 'tokens', dir), {
      withFileTypes: true,
    })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(rel);
      else files[rel] = await readFile(join(cwd, 'tokens', rel), 'utf8');
    }
  };
  await walk('');
  return files;
}

async function brands() {
  const cwd = await exampleFixture('vtk-batch-', 'brands');
  return { cwd, project: await loadProject(cwd) };
}

// The shared token FIRST: alone it dangles for Globex (no berry ramp); the batch ends valid.
const SHARED_FIRST = `
# shared first — only valid once the override exists
token add color.accent '{color.berry.500}' --type color --set core
token add color.accent '{color.brand.500}' --type color --set globex/palette
`;

test('an order that only works as a whole runs as a batch, validated and written once', async () => {
  const { cwd, project } = await brands();
  const io = capture();
  expect(await runBatch({ project, text: SHARED_FIRST, json: true })).toBe(0);
  const report = JSON.parse(io.out());
  expect(report).toMatchObject({ ok: true, command: 'batch', dryRun: false });
  expect(report.results.map((r: { line: number }) => r.line)).toEqual([3, 4]);
  expect(report.files.sort()).toEqual(['core.json', 'globex/palette.json']);
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  expect(core.color.accent.$value).toBe('{color.berry.500}');
});

test('--dry-run previews the whole sequence and writes nothing', async () => {
  const { cwd, project } = await brands();
  const before = await snapshot(cwd);
  const io = capture();
  expect(await runBatch({ project, text: SHARED_FIRST, dryRun: true })).toBe(0);
  expect(io.out()).toContain('would write core.json');
  expect(await snapshot(cwd)).toEqual(before);
});

test('an end state that breaks a rule is refused, and nothing is written', async () => {
  const { cwd, project } = await brands();
  const before = await snapshot(cwd);
  const io = capture();
  const code = await runBatch({
    project,
    text: `token add color.accent '{color.berry.500}' --type color --set core`,
  });
  expect(code).toBe(1);
  expect(io.err()).toContain('refused');
  expect(io.err()).toContain('dangling');
  expect(await snapshot(cwd)).toEqual(before);
});

test('a line that fails stops the batch, named, and nothing is written', async () => {
  const { cwd, project } = await brands();
  const before = await snapshot(cwd);
  const io = capture();
  const code = await runBatch({
    project,
    text: `set add extra\ntoken remove no.such.token\nset add later`,
    json: true,
  });
  expect(code).toBe(1);
  expect(JSON.parse(io.out())).toEqual({
    ok: false,
    command: 'batch',
    line: 2,
    error: "no token at 'no.such.token'",
  });
  expect(await snapshot(cwd)).toEqual(before);
});

test('every line is parsed before anything runs: a bad one exits 2, naming it', async () => {
  const { cwd, project } = await brands();
  const before = await snapshot(cwd);
  const cases: Array<[string, string]> = [
    ['set add extra\nbuild', "line 2: 'build' can't run in a batch"],
    ['set add extra\ntoken add only.path', 'line 2: missing required argument'],
    [
      'set add extra --json',
      'line 1: --json belongs to the batch, not to a line',
    ],
    ['set add extra\nnope nope', "line 2: unknown command 'nope'"],
    ["token add 'open", 'line 1: unterminated quote'],
    ['# only a comment', 'the batch has no commands'],
  ];
  for (const [text, message] of cases) {
    const io = capture();
    expect(await runBatch({ project, text }), text).toBe(2);
    expect(io.err(), text).toContain(message);
    vi.restoreAllMocks();
  }
  expect(await snapshot(cwd)).toEqual(before);
});

test('a contributed command runs in a batch like a built-in one', async () => {
  const { cwd, project } = await brands();
  const io = capture();
  expect(await runBatch({ project, text: 'ramp build' })).toBe(0);
  expect(io.out()).toMatch(/^1: built \d+ ramp\(s\)/m);
  const palette = JSON.parse(
    await readFile(join(cwd, 'tokens/acme/palette.json'), 'utf8'),
  );
  expect(
    palette.color.berry['500'].$extensions['org.vertekum.generate/ramp'],
  ).toBe('committed');
});
