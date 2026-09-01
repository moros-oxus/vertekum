import {
  type CommandDescriptor,
  type Document,
  type DtcgNode,
  restoreFiles,
} from '@vertekum/core';
import { followAliases, rampCarriers } from './api';
import { computeRamp, type RampConfig, type RampPayload } from './ramp';

/**
 * `vertekum ramp build [--check]` — the COMMITTED mode. Writes each ramp's computed stops as
 * real tokens under its group (regenerating existing children); the payload remains the single
 * source of truth. `--check` compares committed groups against a fresh computation and fails on
 * staleness — the CI guard. Virtual (childless) groups are the codec's business and are left
 * alone by `--check`.
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

      const computed: Array<{
        set: string;
        path: string[];
        children: boolean;
        stops: Record<string, unknown>;
      }> = [];
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
          if (!ramp.children) continue; // virtual — served by the codec, nothing committed
          const node = nodeAt(files, ramp.set, ramp.path);
          for (const [name, stop] of Object.entries(ramp.stops)) {
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
        const committed = computed.filter((r) => r.children).length;
        return {
          summary: `${committed} committed ramp(s) fresh, ${computed.length - committed} virtual`,
        };
      }

      const next = structuredClone(files);
      let stops = 0;
      for (const ramp of computed) {
        const node = nodeAt(next, ramp.set, ramp.path);
        if (!node) continue;
        for (const key of Object.keys(node)) {
          if (!key.startsWith('$')) delete node[key];
        }
        for (const [name, stop] of Object.entries(ramp.stops)) {
          node[name] = { $type: 'color', $value: stop };
          stops++;
        }
      }
      document.apply(restoreFiles(next));
      return {
        summary: `built ${computed.length} ramp(s), ${stops} stop(s)`,
      };
    },
  };
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
