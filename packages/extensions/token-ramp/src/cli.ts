import {
  type CommandDescriptor,
  type Document,
  type DtcgNode,
  restoreFiles,
} from '@vertekum/core';
import { followAliases, type RampCarrier, rampCarriers } from './api';
import {
  COMMITTED,
  computeRamp,
  RAMP_KEY,
  type RampConfig,
  type RampPayload,
} from './ramp';

/**
 * `vertekum ramp build [--check]` — the COMMITTED mode. Writes each ramp's computed stops as
 * real tokens under its group, each MARKED as committed, so a later build knows which children it
 * owns: it rewrites marked stops and never touches an unmarked child (an authored override) or
 * `$root`. `--check` compares the marked stops against a fresh computation and fails on
 * staleness — the CI guard. Overrides are never stale, and a step with no child is virtual —
 * served by the codec.
 *
 * The handler edits the raw trees (the file is the model) and applies them as one undoable
 * command; the runner owns persistence, `--dry-run`, `--json`, and refuses a change that would
 * introduce errors.
 */
export function rampBuildCommand(
  settings: () => RampConfig,
): CommandDescriptor {
  return {
    name: 'ramp build',
    description:
      'write each ramp payload’s computed stops as real tokens (--check: report stale stops instead)',
    args: [],
    options: [
      {
        flag: '--check',
        description:
          'compare committed stops against the payloads; fail when stale',
      },
    ],
    run(ctx) {
      const document = (ctx.project as { document?: Document }).document;
      if (!document) throw new Error('no project document');
      const files = document.getFiles();
      const tokens = document.getAllTokens();
      const carriers = rampCarriers(files);
      if (carriers.length === 0) {
        throw new Error('no ramp payloads in the collection');
      }

      const computed: Computed[] = [];
      for (const carrier of carriers) {
        const payload = carrier.payload as RampPayload;
        const ramp = computeRamp(
          payload,
          settings(),
          followAliases(payload.anchor, tokens),
        );
        if ('error' in ramp) {
          throw new Error(`'${carrier.path.join('.')}': ${ramp.error}`);
        }
        computed.push({ ...carrier, stops: ramp.stops });
      }

      if (ctx.options.check === true) {
        const stale: string[] = [];
        for (const ramp of computed) {
          const node = nodeAt(files, ramp.set, ramp.path);
          for (const name of ramp.committed) {
            if (!(name in ramp.stops)) continue; // a step the scalar no longer names
            const stop = ramp.stops[name];
            const child = node?.[name] as DtcgNode | undefined;
            if (
              child?.$type !== 'color' ||
              JSON.stringify(child.$value) !== JSON.stringify(stop)
            ) {
              stale.push(`${ramp.path.join('.')}.${name}`);
            }
          }
        }
        if (stale.length > 0) {
          throw new Error(
            `stale ramp stop(s): ${stale.join(', ')} — run 'ramp build'`,
          );
        }
        const committed = computed.filter((r) => r.committed.length > 0).length;
        return {
          summary: `${committed} committed ramp(s) fresh, ${computed.length - committed} virtual`,
          data: { ramps: rampData(computed, files) },
        };
      }

      const next = structuredClone(files);
      let stops = 0;
      let kept = 0;
      for (const ramp of computed) {
        const node = nodeAt(next, ramp.set, ramp.path);
        if (!node) continue;
        for (const name of ramp.committed) delete node[name];
        for (const [name, stop] of Object.entries(ramp.stops)) {
          if (ramp.overrides.includes(name)) {
            kept++;
            continue;
          }
          node[name] = {
            $type: 'color',
            $value: stop,
            $extensions: { [RAMP_KEY]: COMMITTED },
          };
          stops++;
        }
      }
      document.apply(restoreFiles(next));
      return {
        summary: `built ${computed.length} ramp(s), ${stops} stop(s)${
          kept > 0 ? `, ${kept} override(s) kept` : ''
        }`,
        data: { ramps: rampData(computed, next) },
      };
    },
  };
}

type Computed = RampCarrier & { stops: Record<string, unknown> };

/**
 * The machine-readable result both modes emit under `--json`: every ramp's EFFECTIVE stops — an
 * override's value where the author wrote one, the file's value for a committed stop, else the
 * computed one — and which steps are overridden. A first-class value source: documentation
 * pipelines read this instead of parsing CSS.
 */
function rampData(
  computed: Computed[],
  files: Record<string, DtcgNode>,
): Array<{
  set: string;
  path: string;
  committed: boolean;
  overridden: string[];
  stops: Record<string, unknown>;
}> {
  return computed.map((ramp) => {
    const node = nodeAt(files, ramp.set, ramp.path);
    const stops: Record<string, unknown> = {};
    for (const [name, stop] of Object.entries(ramp.stops)) {
      const child = node?.[name] as DtcgNode | undefined;
      stops[name] = child && '$value' in child ? child.$value : stop;
    }
    return {
      set: ramp.set,
      path: ramp.path.join('.'),
      committed: ramp.committed.length > 0,
      overridden: ramp.overrides.filter((name) => name in ramp.stops),
      stops,
    };
  });
}

function nodeAt(
  files: Record<string, DtcgNode>,
  set: string,
  path: string[],
): DtcgNode | undefined {
  let cursor: DtcgNode | undefined = files[`${set}.json`];
  for (const segment of path) {
    if (!cursor) return undefined;
    const next: unknown = cursor[segment];
    cursor = next && typeof next === 'object' ? (next as DtcgNode) : undefined;
  }
  return cursor;
}
