import type {
  CommandDescriptor,
  CommandExtension,
  CommandRegistry,
} from './types';

/**
 * Chain points that are extensible without being registered commands: `build` belongs to the
 * client (it owns persistence and the run loop), but its chain is consulted in CORE's export
 * staging, so every client — CLI, app route, programmatic caller — sees one code path.
 */
const EXTENSIBLE_POINTS = new Set(['build']);

/**
 * The CLI counterpart of the route registry: extensions register commands, the host attaches them
 * to its program. A duplicate name throws at registration, so a collision is a startup error rather
 * than a command silently shadowing another.
 *
 * `extend` joins the chain of an existing command instead of declaring a new one — the chain of
 * responsibility from the curation-floor design. Chains are consulted by the command's own
 * handler (or, for `build`, by core's export staging); order is registration order, which the
 * kernel derives from the config's `extensions: []` array.
 */
export function createCommandRegistry(): CommandRegistry {
  const commands: CommandDescriptor[] = [];
  const chains = new Map<string, CommandExtension[]>();

  return {
    register(command) {
      if (commands.some((c) => c.name === command.name)) {
        throw new Error(`command '${command.name}' is already registered`);
      }
      commands.push(command);
    },
    extend(name, extension) {
      if (
        !EXTENSIBLE_POINTS.has(name) &&
        !commands.some((c) => c.name === name)
      ) {
        throw new Error(
          `cannot extend '${name}' — no such command; registered: ${commands
            .map((c) => c.name)
            .join(', ')}`,
        );
      }
      const chain = chains.get(name) ?? [];
      chain.push(extension);
      chains.set(name, chain);
    },
    list() {
      return [...commands];
    },
    extensionsOf(name) {
      return [...(chains.get(name) ?? [])];
    },
  };
}
