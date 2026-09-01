import {
  anchorShell,
  applyPatches,
  isPatchDocument,
  type SchemaPatch,
} from './extend';
import type { SchemaBinding } from './schema';
import type { Diagnostic } from './validator';

/**
 * Binding assembly: ONE schema surface, three delivery routes. Bindings arrive from the built-ins,
 * from config `schemas[]` (the loader), and from extensions (the `'schema-bindings'` service) —
 * in that order — and this pass makes them one coherent set:
 *
 * 1. `id` resolution, LAST WINS, across every route — an extension can eject/replace exactly as
 *    config can; `origin` keeps it visible in `describe`.
 * 2. Patch documents (top-level `$extends`) split out and merged into the effective `dtcg-tokens`
 *    schema, in order.
 * 3. The anchor shell is derived from the PATCHED effective schema and returned as a referenced
 *    schema, so every binding may `$ref: "dtcg#…"`.
 */
export interface AssembledSchemas {
  bindings: SchemaBinding[];
  /** Additional resolution targets (the anchor shell) for `validateFiles`' `referenced`. */
  referenced: object[];
  diagnostics: Diagnostic[];
}

function labelOf(binding: SchemaBinding): string {
  return (
    binding.file ??
    binding.id ??
    binding.domain ??
    [binding.match].flat().join(', ')
  );
}

export function assembleBindings(sources: SchemaBinding[]): AssembledSchemas {
  // `id` resolution in place: a later binding with the same id replaces the earlier one at its
  // position (the loader already resolved config-over-builtin; this extends the rule to the
  // extension route).
  const resolved: SchemaBinding[] = [];
  for (const binding of sources) {
    const at =
      binding.id === undefined
        ? -1
        : resolved.findIndex((held) => held.id === binding.id);
    if (at === -1) resolved.push(binding);
    else resolved[at] = binding;
  }

  const patches: SchemaPatch[] = [];
  const bindings: SchemaBinding[] = [];
  for (const binding of resolved) {
    if (isPatchDocument(binding.schema)) {
      patches.push({ document: binding.schema, label: labelOf(binding) });
    } else {
      bindings.push(binding);
    }
  }

  const diagnostics: Diagnostic[] = [];
  const dtcgAt = bindings.findIndex((b) => b.id === 'dtcg-tokens');
  if (dtcgAt === -1) {
    for (const patch of patches) {
      diagnostics.push({
        code: 'schema/unknown-extend-target',
        severity: 'error',
        message: `'${patch.label}' extends the DTCG schema, but no 'dtcg-tokens' binding exists`,
        source: 'core',
      });
    }
    return { bindings, referenced: [], diagnostics };
  }

  const held = bindings[dtcgAt] as SchemaBinding;
  const effective = structuredClone(held.schema);
  diagnostics.push(...applyPatches(effective, patches));
  bindings[dtcgAt] = { ...held, schema: effective };

  return { bindings, referenced: [anchorShell(effective)], diagnostics };
}
