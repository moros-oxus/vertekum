import type { ResolverDocument } from '../document/resolver-types';
import type { DtcgNode } from './parse';

/** Known top-level keys, emitted in this order; everything else is preserved as pass-through. */
const KNOWN = [
  'version',
  'name',
  'description',
  'sets',
  'modifiers',
  'resolutionOrder',
];
const KNOWN_SET = new Set(KNOWN);

function asObject(v: unknown, field: string): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`resolver: ${field} must be an object`);
  }
  return v as Record<string, unknown>;
}
function asArray(v: unknown, field: string): unknown[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new Error(`resolver: ${field} must be an array`);
  return v;
}

/** Parse + validate a resolver document, preserving unknown top-level keys verbatim. */
export function parseResolver(node: DtcgNode): ResolverDocument {
  if (node.version !== '2025.10') {
    throw new Error(
      `resolver: unsupported version ${JSON.stringify(node.version)} (expected "2025.10")`,
    );
  }
  const doc: ResolverDocument = {
    version: '2025.10',
    sets: asObject(node.sets, 'sets') as ResolverDocument['sets'],
    modifiers: asObject(
      node.modifiers,
      'modifiers',
    ) as ResolverDocument['modifiers'],
    resolutionOrder: asArray(
      node.resolutionOrder,
      'resolutionOrder',
    ) as ResolverDocument['resolutionOrder'],
  };
  if (typeof node.name === 'string') doc.name = node.name;
  if (typeof node.description === 'string') doc.description = node.description;
  for (const [key, value] of Object.entries(node)) {
    if (!KNOWN_SET.has(key))
      (doc as unknown as Record<string, unknown>)[key] = value;
  }
  return doc;
}

/** Serialize a resolver document with a stable key order, appending pass-through keys. */
export function serializeResolver(doc: ResolverDocument): DtcgNode {
  const out: DtcgNode = { version: doc.version };
  if (doc.name !== undefined) out.name = doc.name;
  if (doc.description !== undefined) out.description = doc.description;
  out.sets = doc.sets;
  out.modifiers = doc.modifiers;
  out.resolutionOrder = doc.resolutionOrder;
  for (const [key, value] of Object.entries(doc)) {
    if (!KNOWN_SET.has(key)) out[key] = value;
  }
  return out;
}
