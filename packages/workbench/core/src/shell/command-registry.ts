import type { CommandDescriptor, CommandRegistry } from './types';

/**
 * The CLI counterpart of the route registry: extensions register commands, the host attaches them
 * to its program. A duplicate name throws at registration, so a collision is a startup error rather
 * than a command silently shadowing another.
 */
export function createCommandRegistry(): CommandRegistry {
  const commands: CommandDescriptor[] = [];

  return {
    register(command) {
      if (commands.some((c) => c.name === command.name)) {
        throw new Error(`command '${command.name}' is already registered`);
      }
      commands.push(command);
    },
    list() {
      return [...commands];
    },
  };
}
