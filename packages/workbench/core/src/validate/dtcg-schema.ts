import tokenSchema from '@vertekum/schema-dtcg/format.json';
import resolverSchema from '@vertekum/schema-dtcg/resolver.json';

/**
 * The built-in DTCG schemas — **files, not code**.
 *
 * They are ordinary members of `@vertekum/schema-dtcg`, the same kind of thing
 * `@vertekum/schema-atlassian` ships. The only difference is that core depends on this one, which is
 * what makes DTCG well-formedness the default rather than a choice.
 *
 * Imported rather than read: they apply with no configuration, need no filesystem access, and still
 * bundle for the browser. A project that needs to track a spec change or loosen a rule ejects the
 * file and binds it back with `id: 'dtcg-tokens'`, which replaces this binding rather than layering
 * beside it.
 *
 * The reasoning behind each keyword lives in that package's README — a JSON file has nowhere to put
 * a comment, and that is exactly where reasoning goes to die.
 */
export const DTCG_TOKEN_SCHEMA = tokenSchema;
export const DTCG_RESOLVER_SCHEMA = resolverSchema;
