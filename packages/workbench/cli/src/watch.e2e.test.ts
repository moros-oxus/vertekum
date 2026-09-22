import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

/**
 * `watch` end to end: a real subprocess, a real file edit, and the ndjson stream as the contract.
 * The loop never exits on its own, so the spec drives it by events and stops it with SIGINT.
 */

interface WatchEvent {
  event: string;
  ok?: boolean;
  files?: string[];
  trigger?: string;
  diagnostics?: unknown[];
}

/** Spawn `vertekum watch --json` and hand back an event reader plus a stop function. */
function startWatch(cwd: string): {
  next(predicate: (e: WatchEvent) => boolean): Promise<WatchEvent>;
  stop(): void;
} {
  // Debug tracing on: when a run fails on a machine we cannot attach to (CI), the child's own
  // account of which paths it watched and which events arrived is the evidence.
  const child = spawn('node', [bin, 'watch', '--json'], {
    cwd,
    env: { ...process.env, VTK_WATCH_DEBUG: '1' },
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const seen: WatchEvent[] = [];
  const waiters: Array<{
    predicate: (e: WatchEvent) => boolean;
    resolve: (e: WatchEvent) => void;
  }> = [];
  let buffer = '';

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as WatchEvent;
      seen.push(event);
      const index = waiters.findIndex((w) => w.predicate(event));
      if (index >= 0) waiters.splice(index, 1)[0]?.resolve(event);
    }
  });

  return {
    next(predicate) {
      const already = seen.find(predicate);
      if (already) {
        seen.splice(seen.indexOf(already), 1);
        return Promise.resolve(already);
      }
      return new Promise<WatchEvent>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                // What the watcher actually said, so a CI failure is diagnosable from the log
                // rather than reporting only that time ran out.
                [
                  'timed out waiting for a watch event',
                  `events seen: ${JSON.stringify(seen)}`,
                  `stderr: ${stderr.slice(-2000) || '(none)'}`,
                ].join('\n'),
              ),
            ),
          // Comfortably UNDER the per-test timeout below: if this budget matched it, vitest would
          // kill the test first and the diagnosis above would never be printed — which is exactly
          // what wasted two CI runs.
          20_000,
        );
        waiters.push({
          predicate,
          resolve: (event) => {
            clearTimeout(timer);
            resolve(event);
          },
        });
      });
    },
    stop: () => child.kill('SIGINT'),
  };
}

test('a token edit rebuilds the configured target', async () => {
  const cwd = await exampleFixture('vtk-watch-', 'agentic');
  const watcher = startWatch(cwd);
  try {
    // The first pass runs before anything changes: the output exists from the start.
    const first = await watcher.next((e) => e.event === 'pass');
    expect(first.ok).toBe(true);
    expect(first.files?.some((f) => f.endsWith('.css'))).toBe(true);

    const watching = await watcher.next((e) => e.event === 'watching');
    expect(watching).toBeTruthy();

    const tokenFile = join(cwd, 'tokens/core.json');
    const before = await readFile(tokenFile, 'utf8');
    await writeFile(tokenFile, `${before.replace(/\s+$/, '')}\n`);

    const second = await watcher.next(
      (e) => e.event === 'pass' && e.trigger !== undefined,
    );
    expect(second.ok).toBe(true);
    expect(second.files?.length ?? 0).toBeGreaterThan(0);
  } finally {
    watcher.stop();
  }
}, 120_000);

test('a .dfn edit reruns the generator before the check', async () => {
  const cwd = await exampleFixture('vtk-watch-dfn-', 'schemas');
  const watcher = startWatch(cwd);
  try {
    const first = await watcher.next((e) => e.event === 'pass');
    expect(first.ok).toBe(true);
    // The generator runs in the very first pass: its artifact is what the check reads.
    expect(first.files).toContain('schemas/house.json');

    const watching = await watcher.next((e) => e.event === 'watching');
    expect(watching.event).toBe('watching');

    // Grant one MORE name in the grammar — adding, never removing, or the tokens the example
    // already has would stop being granted and the check would (correctly) fail.
    const dfn = join(cwd, 'schemas/house.dfn');
    const grammar = await readFile(dfn, 'utf8');
    await writeFile(
      dfn,
      grammar.replace(
        'neutral | brand | success',
        'neutral | brand | success | warning',
      ),
    );

    const rebuilt = await watcher.next(
      (e) => e.event === 'pass' && e.trigger !== undefined,
    );
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.files).toContain('schemas/house.json');
    expect(await readFile(join(cwd, 'schemas/house.json'), 'utf8')).toContain(
      'warning',
    );
  } finally {
    watcher.stop();
  }
}, 120_000);

test('a broken edit reports diagnostics and leaves the last good output', async () => {
  const cwd = await exampleFixture('vtk-watch-bad-', 'agentic');
  const watcher = startWatch(cwd);
  try {
    const first = await watcher.next((e) => e.event === 'pass');
    expect(first.ok).toBe(true);
    const output = join(cwd, 'build/css');
    const good = await readFile(join(output, 'tokens.css'), 'utf8').catch(
      () => undefined,
    );

    await watcher.next((e) => e.event === 'watching');

    // A dangling reference: check fails, so nothing is exported.
    const tokenFile = join(cwd, 'tokens/core.json');
    const source = JSON.parse(await readFile(tokenFile, 'utf8'));
    source.__watchProbe = {
      $type: 'color',
      $value: '{nothing.at.all}',
    };
    await writeFile(tokenFile, JSON.stringify(source, null, 2));

    const failed = await watcher.next(
      (e) => e.event === 'pass' && e.ok === false,
    );
    expect(failed.diagnostics?.length ?? 0).toBeGreaterThan(0);
    expect(failed.files ?? []).toEqual([]);

    if (good !== undefined) {
      expect(await readFile(join(output, 'tokens.css'), 'utf8')).toBe(good);
    }
  } finally {
    watcher.stop();
  }
}, 120_000);
