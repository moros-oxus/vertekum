import type { CommandDescriptor } from '../shell/types';
import { groupVerbs } from './group-verbs';
import { resolverVerbs } from './resolver-verbs';
import { setVerbs } from './set-verbs';
import { tokenVerbs } from './token-verbs';

export { documentOf, isGroupPath, parseValue, tokenAtPath } from './context';
export { groupVerbs } from './group-verbs';
export { resolverVerbs } from './resolver-verbs';
export { setVerbs } from './set-verbs';
export { tokenVerbs } from './token-verbs';

/**
 * Core's built-in curation verbs, seeded into the kernel's command registry at construction.
 *
 * They are `CommandDescriptor`s — the same shape extensions contribute — so a built-in and a
 * contributed verb are indistinguishable to a client. The CLI attaches whatever is in the registry,
 * `describe` publishes it, and a future client (an MCP server, a hosted API) enumerates one list
 * rather than a built-in table plus a contributed one.
 */
export function builtinCommands(): CommandDescriptor[] {
  return [...tokenVerbs, ...groupVerbs, ...setVerbs, ...resolverVerbs];
}
