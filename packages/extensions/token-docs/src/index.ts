import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { z } from 'zod';
import { activate } from './api';

export {
  DOCS_KEY,
  type DocsPayload,
  docsOf,
  docsOfNode,
  withNote,
} from './docs';

/**
 * The project's own note vocabulary.
 *
 * `categories` are the audiences a project writes for — documentation, an agent, an MCP client,
 * a review process. Each becomes a flag on `token add` / `token set` (`--docs`, `--llm`, …) and a
 * key in storage, and `vertekum describe` reports them, so an agent can ask what this project
 * accepts instead of guessing. Declaring them is what makes a typo an error rather than a new
 * category nothing reads.
 *
 * `default` is the category `--comment` writes to — the short spelling for the common case.
 */
export const TokenDocsSettings = z.object({
  categories: z
    .array(
      z
        .string()
        .regex(
          /^[a-z][a-z0-9-]*$/,
          'a category is lower-case letters, digits and hyphens',
        ),
    )
    .min(1)
    .default(['docs', 'llm', 'mcp']),
  default: z.string().default('docs'),
});
export type TokenDocsSettingsType = z.infer<typeof TokenDocsSettings>;

export const tokenDocsManifest = {
  id: 'vtk.token.docs',
  name: 'Token Docs',
  description:
    "Notes on tokens and groups for documentation, agents and MCP: one note per configured category, stored under 'org.vertekum.docs' in $extensions. Written while a token is created or changed, or through the 'docs' verbs. A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
  settings: TokenDocsSettings,
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: a chain link on the token verbs, the `docs` verbs, and a
 * payload schema. The notes are plain `$extensions` data — anything that reads a token can read
 * them, with or without this package installed.
 */
export const tokenDocsExtension = defineExtension<typeof tokenDocsManifest>({
  manifest: tokenDocsManifest,
  activate,
});
