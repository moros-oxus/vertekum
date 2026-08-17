import { dtcg, updateTokenValue } from '@vertekum/core';
import type { Project } from '../loadProject';
import { saveProject } from '../saveProject';

export interface MigrateOptions {
  project: Project;
  dryRun?: boolean;
  write?: (line: string) => void;
}

/** The types whose stored strings have a spec object form to migrate to. */
const MIGRATABLE = new Set(['color', 'dimension', 'duration']);

/**
 * `vertekum migrate values`: convert stored string values to 2025.10 object notation, by each
 * token's EFFECTIVE type.
 *
 * Parse-or-report-untouched, never best-effort: a value the codec cannot parse is listed with its
 * path and left exactly as it was. References are never touched — aliases are strings by spec.
 * Rerunnable and idempotent: object values are not strings, so a second run converts nothing.
 */
export async function runMigrate(options: MigrateOptions): Promise<number> {
  const { project, dryRun } = options;
  const write =
    options.write ?? ((line: string) => process.stdout.write(`${line}\n`));

  let converted = 0;
  let failed = 0;
  let skipped = 0;

  for (const token of project.document.getAllTokens()) {
    if (!MIGRATABLE.has(token.type)) continue;
    if (typeof token.value !== 'string') continue;
    // A pointer token's value is derived (token-position) or notation-carrying (value-position):
    // writing the materialized value back would silently destroy the reference.
    if (token.ref !== undefined || token.sourceValue !== undefined) continue;
    if (dtcg.tokens.isReference(token.value)) {
      skipped += 1;
      continue;
    }

    const object = await dtcg.values.parse(token.type, token.value, {
      colorSpace: project.valueOptions.colorSpace,
    });
    const label = `${token.set}:${token.path.join('.')}`;
    if (object === undefined) {
      failed += 1;
      write(
        `  cannot parse ${label} = ${JSON.stringify(token.value)} (left untouched)`,
      );
      continue;
    }

    converted += 1;
    write(`  ${label}: ${JSON.stringify(token.value)} -> ${token.type} object`);
    if (!dryRun) project.document.apply(updateTokenValue(token.id, object));
  }

  if (!dryRun && converted > 0) await saveProject(project);

  write(
    `${dryRun ? 'would convert' : 'converted'} ${converted}, references skipped ${skipped}, unparseable ${failed}`,
  );
  return failed > 0 ? 1 : 0;
}
