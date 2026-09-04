import type {
  FigmaCollection,
  FigmaDialect,
  FigmaStyle,
  FigmaVariable,
} from '@vertekum/ext-export-figma';

/**
 * The `microsoft-manifest` dialect: the sidecar-manifest, file-per-mode shape consumed by
 * microsoft/figma-variables-import and its "Variables JSON Import" lineage — the healthiest
 * import door the 2026 survey found.
 *
 * Deliberately lossy, because the door is: colors downgrade to hex strings, dimensions to plain
 * numbers, and STYLES FLATTEN to per-property variables (that importer creates variables only —
 * it cannot create styles). Nothing is dropped; what the flattening and downgrade lose is exactly
 * what a consumer of the canonical model keeps.
 */

export interface MicrosoftManifestOptions {
  /**
   * How modes reach a seat that may not have them:
   *  - 'native' (default): modes as modes, one file per collection-mode;
   *  - 'split-collections': each context becomes a sibling single-mode collection
   *    (`color-mode/light`), for seats without multi-mode collections;
   *  - 'split-files': one manifest + file set per mode, imported selectively.
   */
  modes?: 'native' | 'split-collections' | 'split-files';
}

type Manifest = {
  name: string;
  collections: Record<string, { modes: Record<string, string[]> }>;
};

const sanitize = (name: string): string => name.replaceAll('/', '-');

/** `{r,g,b,a}` floats → `#rrggbb[aa]`. */
function hex(value: unknown): string {
  const color = value as { r?: number; g?: number; b?: number; a?: number };
  const channel = (v: number | undefined): string =>
    Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255)
      .toString(16)
      .padStart(2, '0');
  const alpha = color.a !== undefined && color.a < 1 ? channel(color.a) : '';
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}${alpha}`;
}

/** One variable's DTCG string-dialect node for a given mode. */
function tokenNode(variable: FigmaVariable, mode: string): object | undefined {
  const alias = variable.alias?.[mode];
  if (alias !== undefined) {
    return { $value: `{${alias.replaceAll('/', '.')}}` };
  }
  const value = variable.valuesByMode[mode] ?? variable.valuesByMode.default;
  if (value === undefined) return undefined;
  switch (variable.type) {
    case 'COLOR':
      return { $type: 'color', $value: hex(value) };
    case 'FLOAT':
      return { $type: 'number', $value: value };
    case 'BOOLEAN':
      return { $type: 'boolean', $value: value };
    default:
      return { $type: 'string', $value: String(value) };
  }
}

/** Styles flatten to per-property STRING/number variables under the style's own path. */
function styleVariables(styles: FigmaStyle[]): FigmaVariable[] {
  return styles.flatMap((style) =>
    style.properties.map((property) => ({
      name: `${style.name}/${property.property}`,
      type: 'STRING' as const,
      valuesByMode: { default: String(property.value) },
      ...(property.variable ? { alias: { default: property.variable } } : {}),
      scopes: [],
      codeSyntax: {},
    })),
  );
}

/** Nested DTCG tree for one collection-mode. */
function fileFor(
  variables: FigmaVariable[],
  mode: string,
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const variable of variables) {
    const node = tokenNode(variable, mode);
    if (node === undefined) continue;
    const segments = variable.name.split('/');
    let cursor = root;
    for (const segment of segments.slice(0, -1)) {
      const next = cursor[segment];
      if (next && typeof next === 'object' && !('$value' in (next as object))) {
        cursor = next as Record<string, unknown>;
      } else {
        const created: Record<string, unknown> = {};
        cursor[segment] = created;
        cursor = created;
      }
    }
    cursor[segments.at(-1) as string] = node;
  }
  return root;
}

export function microsoftManifest(
  options: MicrosoftManifestOptions = {},
): FigmaDialect {
  const strategy = options.modes ?? 'native';
  return {
    id: 'microsoft-manifest',
    write(model) {
      const files: Array<{ path: string; content: string }> = [];
      const flattened = styleVariables(model.styles);

      // Styles ride in the FIRST single-mode collection (or their own when none exists).
      const collections: FigmaCollection[] = model.collections.map((c) => ({
        ...c,
        variables:
          c === model.collections.find((x) => x.modes.length === 1) &&
          flattened.length > 0
            ? [...c.variables, ...flattened]
            : c.variables,
      }));
      if (
        flattened.length > 0 &&
        !collections.some((c) => c.modes.length === 1)
      ) {
        collections.push({
          name: 'styles',
          modes: ['default'],
          variables: flattened,
        });
      }

      const emit = (
        manifestPath: string,
        selected: Array<{
          collection: string;
          mode: string;
          variables: FigmaVariable[];
          modeName: string;
        }>,
      ): void => {
        const manifest: Manifest = { name: 'tokens', collections: {} };
        for (const entry of selected) {
          // Named by the MODE (not the manifest-facing mode name), so split-files manifests
          // pointing at different contexts never collide on one path.
          const file = `${sanitize(entry.collection)}.${sanitize(entry.mode)}.tokens.json`;
          let held = manifest.collections[entry.collection];
          if (!held) {
            held = { modes: {} };
            manifest.collections[entry.collection] = held;
          }
          held.modes[entry.modeName] = [file];
          files.push({
            path: file,
            content: `${JSON.stringify(fileFor(entry.variables, entry.mode), null, 2)}\n`,
          });
        }
        files.push({
          path: manifestPath,
          content: `${JSON.stringify(manifest, null, 2)}\n`,
        });
      };

      if (strategy === 'native') {
        emit(
          'manifest.json',
          collections.flatMap((c) =>
            c.modes.map((mode) => ({
              collection: c.name,
              mode,
              modeName: mode,
              variables: c.variables,
            })),
          ),
        );
      } else if (strategy === 'split-collections') {
        emit(
          'manifest.json',
          collections.flatMap((c) =>
            c.modes.map((mode) => ({
              collection: c.modes.length > 1 ? `${c.name}/${mode}` : c.name,
              mode,
              modeName: 'default',
              variables: c.variables,
            })),
          ),
        );
      } else {
        // split-files: a manifest per multi-mode context; single-mode collections in each.
        const multi = collections.filter((c) => c.modes.length > 1);
        const single = collections.filter((c) => c.modes.length === 1);
        const contexts = multi.flatMap((c) =>
          c.modes.map((mode) => ({ collection: c, mode })),
        );
        if (contexts.length === 0) {
          emit(
            'manifest.json',
            single.map((c) => ({
              collection: c.name,
              mode: 'default',
              modeName: 'default',
              variables: c.variables,
            })),
          );
        }
        for (const { collection, mode } of contexts) {
          emit(`manifest.${sanitize(collection.name)}.${sanitize(mode)}.json`, [
            ...single.map((c) => ({
              collection: c.name,
              mode: 'default',
              modeName: 'default',
              variables: c.variables,
            })),
            {
              collection: collection.name,
              mode,
              modeName: 'default',
              variables: collection.variables,
            },
          ]);
        }
      }
      return files;
    },
  };
}
