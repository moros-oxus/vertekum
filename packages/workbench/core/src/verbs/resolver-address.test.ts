import { expect, test } from 'vitest';
import { createDocument, type Document } from '../document/document';
import type { ResolverDocument } from '../document/resolver-types';
import { serializeDocument } from '../storage/provider';
import { closest, resolverAddress, suggest } from './resolver-address';

function empty(): ResolverDocument {
  return { version: '2025.10', sets: {}, modifiers: {}, resolutionOrder: [] };
}

function withResolvers(...names: string[]): Document {
  const document = createDocument();
  document.hydrate(
    serializeDocument(
      [],
      ['core'],
      new Map(names.map((name) => [name, empty()])),
    ),
  );
  return document;
}

test('bare addressing carries the name through unchecked — add wants a new one', () => {
  const document = withResolvers();
  expect(resolverAddress(document, { bare: 'rexall' })).toEqual({
    resolver: 'rexall',
    branch: 'resolver',
  });
  expect(resolverAddress(document, {})).toBeNull();
});

test('both flags refuse — one address per command', () => {
  const document = withResolvers('rexall');
  expect(() => resolverAddress(document, { set: 'a', modifier: 'b' })).toThrow(
    /either -s or -m/,
  );
});

test('-s elides the resolver when exactly one exists', () => {
  const document = withResolvers('rexall');
  expect(resolverAddress(document, { set: 'sem' })).toEqual({
    resolver: 'rexall',
    branch: 'set',
    set: 'sem',
  });
});

test('-s elision refuses with the names when several resolvers exist', () => {
  const document = withResolvers('rexall', 'lilly');
  expect(() => resolverAddress(document, { set: 'sem' })).toThrow(
    /lead the path with one of: rexall, lilly/,
  );
  // Explicit leading resolver resolves it.
  expect(resolverAddress(document, { set: 'lilly/sem' })).toEqual({
    resolver: 'lilly',
    branch: 'set',
    set: 'sem',
  });
});

test('-s with no resolvers points at resolver add', () => {
  const document = withResolvers();
  expect(() => resolverAddress(document, { set: 'sem' })).toThrow(
    /no resolvers exist/,
  );
});

test('a multi-segment -s path with an unknown head is an elided NESTED set, not an error', () => {
  // Nested collection files made this legitimate: 'rexal/sem' is a set named 'rexal/sem'.
  // A typo'd resolver surfaces downstream instead ("no token set file 'rexal/sem.json'").
  const document = withResolvers('rexall');
  expect(resolverAddress(document, { set: 'rexal/sem' })).toEqual({
    resolver: 'rexall',
    branch: 'set',
    set: 'rexal/sem',
  });
});

test('-s refuses a path that names only a resolver or holds an empty segment', () => {
  const document = withResolvers('rexall');
  expect(() => resolverAddress(document, { set: 'rexall' })).toThrow(
    /names only a resolver/,
  );
  expect(() => resolverAddress(document, { set: 'rexall//sem' })).toThrow(
    /empty path segment/,
  );
  // Depth is no longer bounded: the tail is a nested set name.
  expect(resolverAddress(document, { set: 'rexall/sem/deep' })).toEqual({
    resolver: 'rexall',
    branch: 'set',
    set: 'sem/deep',
  });
});

test('-m walks one, two, and three segments by the first-segment-is-resolver rule', () => {
  const document = withResolvers('rexall');
  expect(resolverAddress(document, { modifier: 'theme' })).toEqual({
    resolver: 'rexall',
    branch: 'modifier',
    modifier: 'theme',
    context: undefined,
  });
  // Two segments whose head names a resolver: resolver/modifier.
  expect(resolverAddress(document, { modifier: 'rexall/theme' })).toEqual({
    resolver: 'rexall',
    branch: 'modifier',
    modifier: 'theme',
    context: undefined,
  });
  // Two segments whose head does NOT name a resolver: elided resolver, modifier/context.
  expect(resolverAddress(document, { modifier: 'theme/dark' })).toEqual({
    resolver: 'rexall',
    branch: 'modifier',
    modifier: 'theme',
    context: 'dark',
  });
  expect(resolverAddress(document, { modifier: 'rexall/theme/dark' })).toEqual({
    resolver: 'rexall',
    branch: 'modifier',
    modifier: 'theme',
    context: 'dark',
  });
  expect(() =>
    resolverAddress(document, { modifier: 'nope/theme/dark' }),
  ).toThrow(/no resolver 'nope'/);
});

test('closest and suggest surface near-misses within two edits, silent beyond', () => {
  expect(closest('theem', ['theme', 'brand'])).toBe('theme');
  expect(closest('zzz', ['theme', 'brand'])).toBeUndefined();
  expect(suggest('them', ['theme'])).toBe(" — did you mean 'theme'?");
  expect(suggest('zzz', ['theme'])).toBe('');
});

test('a nested set name re-joins after the resolver segment', () => {
  const document = withResolvers('rexall');
  // Elided: the whole path is the set.
  expect(resolverAddress(document, { set: 'brands/lilly' })).toEqual({
    resolver: 'rexall',
    branch: 'set',
    set: 'brands/lilly',
  });
  // Explicit: first segment is the resolver, the rest is the set.
  expect(resolverAddress(document, { set: 'rexall/brands/lilly' })).toEqual({
    resolver: 'rexall',
    branch: 'set',
    set: 'brands/lilly',
  });
});
