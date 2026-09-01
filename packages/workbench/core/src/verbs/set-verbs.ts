import { addSet, removeSet } from '../document/commands';
import type { CommandDescriptor } from '../shell/types';
import { documentOf, requireArg } from './context';

/**
 * A set name may be a PATH (`brands/brand-a` → `brands/brand-a.json`) — directories are purely
 * organizational. The guard refuses shapes that would escape or confuse the collection.
 */
function requireValidSetName(name: string): void {
  const segments = name.split('/');
  if (
    name.includes('\\') ||
    segments.some((s) => s === '' || s === '.' || s === '..')
  ) {
    throw new Error(
      `'${name}' is not a valid set name — segments separated by '/', no empty, '.' or '..' segments`,
    );
  }
}

/** Set curation. A set is a file, so these create and delete `<name>.json` in the collection. */
export const setVerbs: CommandDescriptor[] = [
  {
    name: 'set add',
    description: 'create a token set (a file in the collection)',
    args: [{ name: 'name', description: "set name, without '.json'" }],
    run(ctx) {
      const document = documentOf(ctx);
      const name = requireArg(ctx, 'name');
      requireValidSetName(name);
      if (document.getSets().includes(name)) {
        throw new Error(`set '${name}' already exists`);
      }
      document.apply(addSet(name));
      return { summary: `added set ${name}` };
    },
  },

  {
    name: 'set remove',
    description: 'delete a token set and every token in it',
    args: [{ name: 'name', description: 'set name' }],
    options: [
      {
        flag: '--force',
        description: 'permit removing a set that still holds tokens',
      },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const name = requireArg(ctx, 'name');
      if (!document.getSets().includes(name)) {
        throw new Error(`no set '${name}'`);
      }

      // The reducer deletes the set's tokens along with it. That is right for a reducer driven by a
      // UI that already confirmed, and wrong as a CLI default: an agent asking to drop a set should
      // not silently discard its contents.
      const held = document.getAllTokens().filter((t) => t.set === name);
      if (held.length > 0 && ctx.options.force !== true) {
        throw new Error(
          `set '${name}' holds ${held.length} token(s). Pass --force to remove them with it.`,
        );
      }

      document.apply(removeSet(name));
      return {
        summary: `removed set ${name}${held.length > 0 ? ` and ${held.length} token(s)` : ''}`,
      };
    },
  },
];
