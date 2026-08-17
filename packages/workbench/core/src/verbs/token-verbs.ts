import {
  addToken,
  moveTokens,
  removeToken,
  renamePath,
  replaceToken,
  updateTokenValue,
} from '../document/commands';
import { tokenId } from '../document/identity';
import { planRename } from '../document/rename';
import { isReference } from '../dtcg/references';
import { DEFAULT_SET } from '../dtcg/serialize';
import { parseValueInput } from '../dtcg/values';
import type { CommandDescriptor } from '../shell/types';
import {
  documentOf,
  inheritedTypeAt,
  isGroupPath,
  parseValue,
  requireArg,
  tokenAtPath,
  valueOptionsOf,
} from './context';

/**
 * The token curation verbs.
 *
 * Every one of these dispatches a document command that already existed — the engine was complete
 * long before it had a surface. What they add is the part a reducer must not do: **refusing**. A
 * reducer that no-ops on an invalid command is correct, because the UI has already constrained the
 * input; a CLI verb that no-ops is a silent failure an agent cannot see. So each verb states why
 * nothing would have happened and throws, and the runner turns that into exit 1 (ADR-0030 amendment).
 *
 * Handlers never write files and never print. They mutate the document; the runner persists.
 */
/** Types whose short-form strings transform into spec value objects. */
const TRANSFORMED = new Set(['color', 'dimension', 'duration']);

const ACCEPTED: Record<string, string> = {
  color:
    'hex (#rgb/#rrggbb/#rrggbbaa), a CSS colour function (rgb(), hsl(), oklch()…), a named colour, or a JSON value object',
  dimension:
    "a number with a spec unit ('4px', '0.25rem'), or a JSON value object",
  duration:
    "a number with a spec unit ('200ms', '0.2s'), or a JSON value object",
};

/**
 * Short form in, spec form stored: transform a string input into the 2025.10 value object by the
 * token's EFFECTIVE type. References pass through untouched (aliases are strings by spec), JSON
 * objects pass through trusted (the base binding validates them), and unparseable input for a
 * transforming type is a verb error naming the accepted forms — never a silent string write for
 * the gate to refuse with a schema message.
 */
async function toStoredValue(
  ctx: Parameters<CommandDescriptor['run']>[0],
  type: string,
  raw: string,
): Promise<unknown> {
  const parsed = parseValue(raw);
  if (typeof parsed !== 'string' || isReference(parsed)) return parsed;

  const object = await parseValueInput(type, parsed, valueOptionsOf(ctx));
  if (object !== undefined) return object;
  if (TRANSFORMED.has(type)) {
    throw new Error(
      `'${parsed}' is not a valid ${type} value — expected ${ACCEPTED[type]}`,
    );
  }
  return parsed;
}

export const tokenVerbs: CommandDescriptor[] = [
  {
    name: 'token add',
    description: 'create a token at a dotted path',
    args: [
      { name: 'path', description: 'dotted path, e.g. color.brand.500' },
      {
        name: 'value',
        description: 'DTCG value; JSON when parseable, else a string',
      },
    ],
    options: [
      {
        flag: '--type <type>',
        description:
          'DTCG $type (required unless a group above the path declares one)',
      },
      { flag: '--description <text>', description: 'DTCG $description' },
      {
        flag: '--set <set>',
        description: `token set (file) to add it to; default '${DEFAULT_SET}'`,
      },
    ],
    async run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path');

      if (tokenAtPath(document, path)) {
        throw new Error(`'${path}' already exists`);
      }
      if (isGroupPath(document, path)) {
        throw new Error(`'${path}' is a group; a group cannot also be a token`);
      }

      const set =
        (ctx.options.set as string) ?? document.getSets()[0] ?? DEFAULT_SET;
      if (!document.getSets().includes(set)) {
        throw new Error(
          `no set '${set}' — existing sets: ${document.getSets().join(', ') || '(none)'}`,
        );
      }

      const segments = path.split('.');

      // Two sources of truth, and no others: what the author declared, or what the group above
      // already declares. A sibling is a peer, not an authority — inferring from one let a single
      // token silently decide the type of everything added beside it.
      const explicit = ctx.options.type as string | undefined;
      const inherited = inheritedTypeAt(document, set, segments);
      const effective = explicit ?? inherited;
      if (!effective) {
        const parent = segments.slice(0, -1).join('.');
        throw new Error(
          `'${path}' needs a --type: no group above it${
            parent ? ` ('${parent}')` : ''
          } declares one`,
        );
      }

      document.apply(
        addToken({
          id: tokenId(set, segments),
          path: segments,
          // An inherited type is left INHERITED. Writing `$type` onto the token would copy a
          // declaration the group already makes, and the copy would not follow if the group's type
          // ever changed — `tokenNode` omits the key when the type is `''`.
          type: explicit ?? '',
          value: await toStoredValue(ctx, effective, requireArg(ctx, 'value')),
          set,
          ...(ctx.options.description
            ? { description: ctx.options.description as string }
            : {}),
        }),
      );

      return {
        summary: `added ${path} (${effective}${explicit ? '' : ', inherited'}) to ${set}`,
      };
    },
  },

  {
    name: 'token remove',
    description: 'delete a token',
    args: [{ name: 'path', description: 'dotted path' }],
    run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path');
      const token = tokenAtPath(document, path);
      if (!token) {
        const hint = isGroupPath(document, path)
          ? " — it is a group; remove its tokens, or use 'token rename' to move them"
          : '';
        throw new Error(`no token at '${path}'${hint}`);
      }

      document.apply(removeToken(token.id));
      return { summary: `removed ${path}` };
    },
  },

  {
    name: 'token set',
    description: "change a token's value, type, or description",
    args: [
      { name: 'path', description: 'dotted path' },
      {
        name: 'value',
        description: 'new value; omit when only --type/--description change',
        required: false,
      },
    ],
    options: [
      { flag: '--type <type>', description: 'set the DTCG $type' },
      {
        flag: '--description <text>',
        description: 'set the DTCG $description',
      },
    ],
    async run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path');
      const token = tokenAtPath(document, path);
      if (!token) throw new Error(`no token at '${path}'`);

      const type = ctx.options.type as string | undefined;
      const description = ctx.options.description as string | undefined;
      const value = ctx.args.value;

      if (
        value === undefined &&
        type === undefined &&
        description === undefined
      ) {
        throw new Error(
          'nothing to change: pass a value, --type, or --description',
        );
      }

      // The transform keys on what the token IS BECOMING: an explicit --type wins, else the
      // token's effective type (parse already resolved inheritance into token.type).
      const effective = type ?? token.type;

      // A value-only edit goes through updateTokenValue so it coalesces in the undo stack the same
      // way an editor keystroke does; anything touching other fields replaces the token wholesale.
      if (type === undefined && description === undefined) {
        document.apply(
          updateTokenValue(
            token.id,
            await toStoredValue(ctx, effective, value ?? ''),
          ),
        );
        return { summary: `set ${path} = ${value}` };
      }

      document.apply(
        replaceToken(token.id, {
          ...token,
          ...(value !== undefined
            ? { value: await toStoredValue(ctx, effective, value) }
            : {}),
          ...(type !== undefined ? { type } : {}),
          ...(description !== undefined ? { description } : {}),
        }),
      );

      const changed = [
        value !== undefined ? 'value' : null,
        type !== undefined ? 'type' : null,
        description !== undefined ? 'description' : null,
      ].filter(Boolean);
      return { summary: `set ${path}: ${changed.join(', ')}` };
    },
  },

  {
    name: 'token move',
    description: 'move a token to another set (set = file)',
    args: [
      { name: 'path', description: 'dotted path' },
      { name: 'set', description: 'destination set name' },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const path = requireArg(ctx, 'path');
      const token = tokenAtPath(document, path);
      if (!token) throw new Error(`no token at '${path}'`);

      const set = requireArg(ctx, 'set');
      if (!document.getSets().includes(set)) {
        throw new Error(
          `no set '${set}' — existing sets: ${document.getSets().join(', ') || '(none)'}`,
        );
      }
      if (token.set === set) {
        throw new Error(`'${path}' is already in '${set}'`);
      }

      document.apply(moveTokens([token.id], set));
      return { summary: `moved ${path} → ${set}` };
    },
  },

  {
    name: 'token rename',
    description: 'rename a token or group, rewriting every reference to it',
    args: [
      { name: 'from', description: 'dotted path to rename' },
      { name: 'to', description: 'new dotted path' },
    ],
    options: [
      { flag: '--allow-group', description: 'permit renaming a whole group' },
    ],
    /**
     * Relocated verbatim from `@vertekum/ext-tokens` — reference-safe rename is a curation
     * primitive, not an extension feature. Behaviour is unchanged and its e2e spec still covers it.
     */
    run(ctx) {
      const document = documentOf(ctx);
      const fromPath = requireArg(ctx, 'from');
      const toPath = requireArg(ctx, 'to');
      const from = fromPath.split('.');
      const to = toPath.split('.');
      const plan = planRename(document.getAllTokens(), from, to);

      if (plan.repathed.length === 0) {
        throw new Error(`no token or group at '${fromPath}'`);
      }
      if (plan.collisions.length > 0) {
        throw new Error(
          `'${toPath}' collides with: ${plan.collisions.join(', ')}`,
        );
      }
      if (plan.isGroup && ctx.options.allowGroup !== true) {
        throw new Error(
          `'${fromPath}' is a group (${plan.repathed.length} tokens). Pass --allow-group to rename it.`,
        );
      }

      // The policy is already enforced above; core's flag is the backstop for drivers that skip it.
      document.apply(renamePath(from, to, { allowGroup: true }));

      return {
        summary: `renamed ${fromPath} → ${toPath}: ${plan.repathed.length} token(s), ${plan.rewritten.length} reference(s)`,
        data: plan,
      };
    },
  },
];
