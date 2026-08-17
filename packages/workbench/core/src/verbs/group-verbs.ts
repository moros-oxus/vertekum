import { restoreFiles } from '../document/commands';
import { setFileName } from '../document/files';
import type { DtcgNode } from '../dtcg/parse';
import { DEFAULT_SET } from '../dtcg/serialize';
import {
  cloneNode,
  deleteNodeAt,
  getNodeAt,
  isTokenNode,
  pruneEmptyAncestors,
  setNodeAt,
} from '../dtcg/tree';
import type { CommandDescriptor } from '../shell/types';
import { documentOf, requireArg } from './context';

/**
 * Group curation.
 *
 * Groups were addressable but not editable: a token verb creates one implicitly and `token rename`
 * moves one, but nothing could declare a group's `$type` or remove a group outright. That gap became
 * visible under a token vocabulary, where a group name is itself something the system permits or
 * refuses.
 *
 * A group is a node WITHOUT `$value`. These verbs refuse to touch a token, so `group remove` can
 * never quietly delete one.
 */

/** Resolve `(set, path)` for a group, refusing a token or a missing node. */
function groupAt(
  document: ReturnType<typeof documentOf>,
  set: string,
  path: string[],
): DtcgNode {
  const files = document.getFiles();
  const tree = files[setFileName(set)];
  if (!tree) {
    throw new Error(
      `no set '${set}' — existing sets: ${document.getSets().join(', ') || '(none)'}`,
    );
  }
  const node = getNodeAt(tree, path);
  if (!node) throw new Error(`no group at '${path.join('.')}' in '${set}'`);
  if (isTokenNode(node)) {
    throw new Error(
      `'${path.join('.')}' is a token, not a group — use 'token remove' or 'token set'`,
    );
  }
  return node;
}

function setOf(
  ctx: Parameters<CommandDescriptor['run']>[0],
  document: ReturnType<typeof documentOf>,
): string {
  const set =
    (ctx.options.set as string) ?? document.getSets()[0] ?? DEFAULT_SET;
  if (!document.getSets().includes(set)) {
    throw new Error(
      `no set '${set}' — existing sets: ${document.getSets().join(', ') || '(none)'}`,
    );
  }
  return set;
}

/** Apply a whole-file edit through the command channel, so it undoes like everything else. */
function writeTree(
  document: ReturnType<typeof documentOf>,
  set: string,
  next: DtcgNode,
): void {
  document.apply(restoreFiles({ [setFileName(set)]: next }));
}

const SET_OPTION = {
  flag: '--set <set>',
  description: 'token set (file) to act in; defaults to the first',
};

export const groupVerbs: CommandDescriptor[] = [
  {
    name: 'group add',
    description: 'create a group, optionally declaring its type',
    args: [{ name: 'path', description: 'dotted path, e.g. color.text' }],
    options: [
      SET_OPTION,
      {
        flag: '--type <type>',
        description: 'DTCG $type, inherited by every token beneath',
      },
      { flag: '--description <text>', description: 'DTCG $description' },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path').split('.');
      const set = setOf(ctx, document);
      const tree = cloneNode(document.getFiles()[setFileName(set)] ?? {});

      if (getNodeAt(tree, path)) {
        throw new Error(`'${path.join('.')}' already exists in '${set}'`);
      }

      setNodeAt(tree, path, {
        ...(ctx.options.type ? { $type: ctx.options.type as string } : {}),
        ...(ctx.options.description
          ? { $description: ctx.options.description as string }
          : {}),
      });
      writeTree(document, set, tree);

      return { summary: `added group ${path.join('.')} to ${set}` };
    },
  },

  {
    name: 'group set',
    description: "declare a group's type or description",
    args: [{ name: 'path', description: 'dotted path' }],
    options: [
      SET_OPTION,
      { flag: '--type <type>', description: 'DTCG $type' },
      { flag: '--description <text>', description: 'DTCG $description' },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path').split('.');
      const set = setOf(ctx, document);
      const type = ctx.options.type as string | undefined;
      const description = ctx.options.description as string | undefined;

      if (type === undefined && description === undefined) {
        throw new Error('nothing to change: pass --type or --description');
      }
      groupAt(document, set, path);

      const tree = cloneNode(document.getFiles()[setFileName(set)] ?? {});
      const node = getNodeAt(tree, path) as DtcgNode;
      if (type !== undefined) node.$type = type;
      if (description !== undefined) node.$description = description;
      writeTree(document, set, tree);

      const changed = [
        type !== undefined ? 'type' : null,
        description !== undefined ? 'description' : null,
      ].filter(Boolean);
      return { summary: `set group ${path.join('.')}: ${changed.join(', ')}` };
    },
  },

  {
    name: 'group remove',
    description: 'remove a group and everything beneath it',
    args: [{ name: 'path', description: 'dotted path' }],
    options: [
      SET_OPTION,
      {
        flag: '--force',
        description: 'permit removing a group that still holds tokens',
      },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path').split('.');
      const set = setOf(ctx, document);
      groupAt(document, set, path);

      // Removing a group takes its tokens with it, so say how many first — the same confirmation
      // `set remove` asks for, and for the same reason.
      const prefix = `${path.join('.')}.`;
      const held = document
        .getAllTokens()
        .filter((t) => t.set === set && t.path.join('.').startsWith(prefix));
      if (held.length > 0 && ctx.options.force !== true) {
        throw new Error(
          `'${path.join('.')}' holds ${held.length} token(s) in '${set}'. Pass --force to remove them with it.`,
        );
      }

      const tree = cloneNode(document.getFiles()[setFileName(set)] ?? {});
      deleteNodeAt(tree, path);
      pruneEmptyAncestors(tree, path);
      writeTree(document, set, tree);

      return {
        summary: `removed group ${path.join('.')} from ${set}${
          held.length > 0 ? ` and ${held.length} token(s)` : ''
        }`,
      };
    },
  },
];
