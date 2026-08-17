import { saveDocument } from '@vertekum/core/node';
import type { Project } from './loadProject';

/**
 * Persist the project's document. The logic lives in `@vertekum/core/node` — writing the collection
 * is the system's job, and the CLI is one of several clients that needs it. This wrapper only knows
 * how to get a document and a directory out of a `Project`.
 */
export async function saveProject(
  project: Project,
  options: { dryRun?: boolean } = {},
): Promise<string[]> {
  return saveDocument(project.document, project.collectionDir, {
    ...options,
    indent: project.indent,
  });
}
