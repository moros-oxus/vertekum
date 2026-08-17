import type { ZodTypeAny } from 'zod';

export type ControlKind = 'checkbox' | 'select' | 'number' | 'text';

/** Peel .default()/.optional() wrappers to reach the underlying Zod type. */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let s = schema;
  while (
    // biome-ignore lint/suspicious/noExplicitAny: Zod 3 internal introspection
    (s as any)._def?.typeName === 'ZodDefault' ||
    // biome-ignore lint/suspicious/noExplicitAny: Zod 3 internal introspection
    (s as any)._def?.typeName === 'ZodOptional'
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: Zod 3 internal introspection
    s = (s as any)._def.innerType;
  }
  return s;
}

/** Map a settings field's Zod type to the form control that edits it. */
export function controlKind(schema: ZodTypeAny): ControlKind {
  // biome-ignore lint/suspicious/noExplicitAny: Zod 3 internal introspection
  const name = (unwrap(schema) as any)._def?.typeName;
  switch (name) {
    case 'ZodBoolean':
      return 'checkbox';
    case 'ZodEnum':
      return 'select';
    case 'ZodNumber':
      return 'number';
    default:
      return 'text';
  }
}

/** The allowed values of a Zod enum field (empty for non-enums). */
export function enumOptions(schema: ZodTypeAny): string[] {
  const s = unwrap(schema);
  // biome-ignore lint/suspicious/noExplicitAny: Zod 3 internal introspection
  const def = (s as any)._def;
  return def?.typeName === 'ZodEnum' ? [...def.values] : [];
}
