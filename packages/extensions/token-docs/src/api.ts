import {
  type ActivateContext,
  type CommandDescriptor,
  type CommandExtension,
  type CommandResult,
  type Document,
  type DtcgNode,
  replaceToken,
  restoreFiles,
  SCHEMA_BINDING_SERVICE,
  type SchemaBindingService,
  type Token,
  type ValuePreparationContext,
  type ValueProposal,
} from '@vertekum/core';
import { DOCS_KEY, type DocsPayload, docsOfNode, withNote } from './docs';
import type { TokenDocsSettingsType, tokenDocsManifest } from './index';

/**
 * Notes are written two ways, and both end up in the same place.
 *
 * While a token is created or changed, a chain link on `token add` / `token set` reads the flags
 * it declared and returns the payload for the verb to merge — the ergonomic case, one command.
 * Afterwards, or for a GROUP, the `docs` verbs edit the node directly. Groups are served here
 * rather than by flags on the group verbs: that would need a second consult point in core for a
 * case documentation reaches for rarely, and these verbs cover both with one code path.
 */

interface Settings {
  categories: string[];
  default: string;
}

/**
 * The project's vocabulary, with the defaults the schema declares. Takes the resolved slice
 * rather than the config object: `ctx.config` is already typed to this extension's settings, so
 * re-narrowing it here would only invent a looser shape.
 */
function settingsOf(slice: TokenDocsSettingsType | undefined): Settings {
  const categories = slice?.categories ?? ['docs', 'llm', 'mcp'];
  return {
    categories,
    default: slice?.default ?? categories[0] ?? 'docs',
  };
}

/** The document out of a command context — the same narrowing core's own verbs make. */
function documentOf(ctx: { project: unknown }): Document {
  const project = ctx.project as { document?: Document } | undefined;
  if (!project?.document) {
    throw new Error('no project document — this verb needs a loaded project');
  }
  return project.document;
}

/** The notes the invocation carries, by category; `--comment` writes the default category. */
function notesFromOptions(
  options: Record<string, unknown>,
  settings: Settings,
): DocsPayload | undefined {
  let payload: DocsPayload | undefined;
  for (const category of settings.categories) {
    const text = options[category];
    if (typeof text === 'string') {
      payload = withNote(payload, category, text);
    }
  }
  if (typeof options.comment === 'string') {
    payload = withNote(payload, settings.default, options.comment);
  }
  return payload;
}

/** One flag per configured category, plus `--comment` for the default one. */
function noteOptions(
  settings: Settings,
): Array<{ flag: string; description: string }> {
  return [
    ...settings.categories.map((category) => ({
      flag: `--${category} <text>`,
      description: `note for '${category}' readers (markdown allowed)`,
    })),
    {
      flag: '--comment <text>',
      description: `note for '${settings.default}' — the default category`,
    },
  ];
}

/**
 * The chain link. It claims neither the type nor the value: a note says nothing about what a
 * token IS, so the value flows on to the built-in transforms untouched.
 */
function noteLink(
  settings: Settings,
): CommandExtension<ValuePreparationContext, ValueProposal> {
  return {
    options: noteOptions(settings),
    handle(context) {
      const notes = notesFromOptions(context.options, settings);
      if (!notes) return undefined;
      // Only the categories this invocation named. The verb merges per key over what the token
      // already carries, so writing one category never erases another — reading the existing
      // payload here would duplicate that, and get it wrong on `token add`, where there is none.
      return { extensions: { [DOCS_KEY]: notes } };
    },
  };
}

/** A node in the document tree at a dotted path — a token node or a group node. */
function nodeAt(document: Document, set: string, path: string[]): DtcgNode {
  let cursor = document.getFiles()[`${set}.json`] as DtcgNode | undefined;
  for (const segment of path) {
    const next = cursor?.[segment];
    if (!next || typeof next !== 'object') {
      throw new Error(`nothing at '${path.join('.')}' in set '${set}'`);
    }
    cursor = next as DtcgNode;
  }
  return cursor as DtcgNode;
}

function tokenAt(document: Document, path: string): Token | undefined {
  return document.getAllTokens().find((t) => t.path.join('.') === path);
}

/** Where a path lives: a token (mutated through the document command) or a group node. */
function locate(
  document: Document,
  path: string,
): { token: Token } | { set: string; path: string[]; node: DtcgNode } {
  const token = tokenAt(document, path);
  if (token) return { token };
  const segments = path.split('.');
  for (const set of document.getSets()) {
    try {
      return { set, path: segments, node: nodeAt(document, set, segments) };
    } catch {
      // Not in this set — try the next.
    }
  }
  throw new Error(`no token or group at '${path}'`);
}

function currentNotes(
  target: ReturnType<typeof locate>,
): DocsPayload | undefined {
  if ('token' in target) {
    const held = target.token.extensions?.[DOCS_KEY];
    return held && typeof held === 'object'
      ? ({ ...held } as DocsPayload)
      : undefined;
  }
  return docsOfNode(target.node);
}

/** Write notes onto a token (a document command) or a group node (the tree it holds). */
function writeNotes(
  document: Document,
  target: ReturnType<typeof locate>,
  notes: DocsPayload,
): void {
  const empty = Object.keys(notes).length === 0;
  if ('token' in target) {
    const extensions = { ...target.token.extensions };
    if (empty) delete extensions[DOCS_KEY];
    else extensions[DOCS_KEY] = notes;
    // Spread the token WITHOUT its extensions first: a conditional `...{extensions}` cannot clear
    // the field, because the token's own copy — notes included — is already in the object. That is
    // how removing the last note silently kept it.
    const { extensions: _prior, ...rest } = target.token;
    document.apply(
      replaceToken(target.token.id, {
        ...rest,
        ...(Object.keys(extensions).length > 0 ? { extensions } : {}),
      }),
    );
    return;
  }
  // A group lives in the file tree, not the token list. Mutating the held node in place would
  // change nothing the runner can see: it persists when the document's VERSION moves, so a silent
  // edit would report success and write nothing. `restoreFiles` applies the set's tree as a
  // command, which bumps the version and lands in the undo stack like any other edit.
  const file = `${target.set}.json`;
  const tree = structuredClone(document.getFiles()[file]) as DtcgNode;
  let cursor = tree;
  for (const segment of target.path) {
    cursor = cursor[segment] as DtcgNode;
  }
  const extensions = { ...(cursor.$extensions as DtcgNode | undefined) };
  if (empty) delete extensions[DOCS_KEY];
  else extensions[DOCS_KEY] = notes;
  if (Object.keys(extensions).length > 0) cursor.$extensions = extensions;
  else delete cursor.$extensions;
  document.apply(restoreFiles({ [file]: tree }));
}

function refuseUnknown(category: string, settings: Settings): void {
  if (settings.categories.includes(category)) return;
  throw new Error(
    `unknown category '${category}' — this project declares: ${settings.categories.join(', ')}`,
  );
}

function docsCommands(settings: Settings): CommandDescriptor[] {
  const pathArg = {
    name: 'path',
    description: 'dotted path to a token or a group',
  };

  return [
    {
      name: 'docs set',
      description: 'write a note on a token or a group',
      args: [pathArg],
      options: noteOptions(settings),
      run(ctx): CommandResult {
        const document = documentOf(ctx);
        const path = ctx.args.path as string;
        const notes = notesFromOptions(ctx.options, settings);
        if (!notes) {
          throw new Error(
            `nothing to write — pass one of: ${settings.categories
              .map((c) => `--${c}`)
              .join(', ')}, or --comment`,
          );
        }
        const target = locate(document, path);
        writeNotes(document, target, { ...currentNotes(target), ...notes });
        return {
          summary: `noted ${path}: ${Object.keys(notes).join(', ')}`,
        };
      },
    },
    {
      name: 'docs show',
      description: 'print the notes on a token or a group',
      args: [pathArg],
      run(ctx): CommandResult {
        const document = documentOf(ctx);
        const path = ctx.args.path as string;
        const notes = currentNotes(locate(document, path)) ?? {};
        const lines = Object.entries(notes).map(
          ([category, text]) => `${category}: ${text}`,
        );
        return {
          summary: lines.length > 0 ? lines.join('\n') : `no notes on ${path}`,
          data: notes,
        };
      },
    },
    {
      name: 'docs remove',
      description: 'remove a note from a token or a group',
      args: [pathArg],
      options: [
        {
          flag: '--category <name>',
          description: 'the category to remove; omit to remove every note',
        },
      ],
      run(ctx): CommandResult {
        const document = documentOf(ctx);
        const path = ctx.args.path as string;
        const category = ctx.options.category as string | undefined;
        if (category !== undefined) refuseUnknown(category, settings);

        const target = locate(document, path);
        const held = currentNotes(target);
        if (!held) throw new Error(`no notes on '${path}'`);
        if (category !== undefined && held[category] === undefined) {
          throw new Error(`no '${category}' note on '${path}'`);
        }

        writeNotes(
          document,
          target,
          category === undefined ? {} : withNote(held, category, ''),
        );
        return {
          summary:
            category === undefined
              ? `removed every note from ${path}`
              : `removed the '${category}' note from ${path}`,
        };
      },
    },
  ];
}

/**
 * Headless activation: the chain link on the token verbs, the `docs` verbs, and a schema binding
 * for the payload — an unknown category is reported by `check` with the project's own list, which
 * is what stops a typo becoming a category nothing reads.
 */
export function activate(ctx: ActivateContext<typeof tokenDocsManifest>): void {
  const settings = settingsOf(ctx.config.get());

  ctx.commands.extend('token add', noteLink(settings) as CommandExtension);
  ctx.commands.extend('token set', noteLink(settings) as CommandExtension);
  for (const command of docsCommands(settings)) {
    ctx.commands.register(command);
  }

  ctx.services.get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)?.register({
    match: '*',
    target: 'tokens',
    domain: 'docs',
    schema: {
      $id: 'vertekum:token-docs',
      type: 'object',
      properties: {
        $extensions: {
          type: 'object',
          properties: {
            [DOCS_KEY]: {
              type: 'object',
              // The project's own vocabulary, so the schema names it rather than allowing any key.
              propertyNames: { enum: settings.categories },
              additionalProperties: { type: 'string' },
            },
          },
        },
      },
    },
  });
}
