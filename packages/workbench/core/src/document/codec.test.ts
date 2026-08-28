import { expect, test } from 'vitest';
import { parseCollection } from '../dtcg/parse';
import { interchangeFiles } from '../dtcg/serialize';
import { createKernel } from '../kernel';
import {
  createTokenCodecRegistry,
  TOKEN_CODEC_SERVICE,
  type TokenCodec,
  type TokenCodecService,
} from './codec';
import { addToken, renamePath, updateTokenValue } from './commands';
import { createDocument } from './document';
import { tokenId } from './identity';
import type { Token } from './types';

/** A token-shaped payload codec — the canonical custom-type tenant. */
const KEY = 'org.test.type';
const textCodec: TokenCodec = {
  key: KEY,
  materialize(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.$type !== 'string') return null;
    return {
      type: p.$type,
      value: p.$value,
      ...(typeof p.$description === 'string'
        ? { description: p.$description }
        : {}),
    };
  },
  serialize(token) {
    return {
      $type: token.type,
      $value: token.sourceValue ?? token.value,
      ...(token.description !== undefined
        ? { $description: token.description }
        : {}),
    };
  },
};

function carrier(payload: unknown, extra: Record<string, unknown> = {}) {
  return { $extensions: { [KEY]: payload, ...extra } };
}

const upper = () =>
  carrier({ $type: 'textCase', $value: 'uppercase' }, { 'org.other': true });

// ── parse: the carrier rule ──────────────────────────────────────────────────

test('a leaf carrier materializes into an ordinary token, provenance stamped', () => {
  const tokens = parseCollection(
    { 'core.json': { font: { case: { upper: upper() } } } },
    [textCodec],
  );
  expect(tokens).toHaveLength(1);
  const token = tokens[0] as Token;
  expect(token.path).toEqual(['font', 'case', 'upper']);
  expect(token.type).toBe('textCase');
  expect(token.value).toBe('uppercase');
  expect(token.codec).toBe(KEY);
  expect(token.set).toBe('core');
  // The carrier's OTHER extension keys ride as foreign extensions; the payload does not.
  expect(token.extensions).toEqual({ 'org.other': true });
});

test('the carrier rule refuses everything else, leaving nodes as authored', () => {
  const files = {
    'core.json': {
      // Children present → group, payload inert.
      withChild: { ...carrier({ $type: 'x', $value: 1 }), kid: { $value: 2 } },
      // $value beside the key → ordinary token; the key rides as a foreign extension.
      withValue: { $value: 3, $extensions: { [KEY]: { $type: 'x' } } },
      // Unregistered key → plain group.
      foreign: { $extensions: { 'org.unknown': {} } },
      // Payload the codec rejects → plain group.
      rejected: carrier({ not: 'token-shaped' }),
    },
  };
  const tokens = parseCollection(files, [textCodec]);
  expect(tokens.map((t) => t.path.join('.'))).toEqual([
    'withChild.kid',
    'withValue',
  ]);
  const withValue = tokens.find((t) => t.path.join('.') === 'withValue');
  expect(withValue?.codec).toBeUndefined();
  expect(withValue?.extensions).toEqual({ [KEY]: { $type: 'x' } });
});

test('two registered keys on one node is not ownable — left as a group', () => {
  const other: TokenCodec = { ...textCodec, key: 'org.other.kind' };
  const tokens = parseCollection(
    {
      'core.json': {
        both: {
          $extensions: {
            [KEY]: { $type: 'x', $value: 1 },
            'org.other.kind': { $type: 'y', $value: 2 },
          },
        },
      },
    },
    [textCodec, other],
  );
  expect(tokens).toEqual([]);
});

// ── document: write paths keep the store conformant ──────────────────────────

function codecDocument() {
  const registry = createTokenCodecRegistry();
  registry.register(textCodec);
  const document = createDocument({ codecs: () => registry.list() });
  return document;
}

test('updateTokenValue on a codec token rewrites the payload, never a stray $value', () => {
  const document = codecDocument();
  document.hydrate({ 'core.json': { font: { case: { upper: upper() } } } });
  document.apply(
    updateTokenValue(tokenId('core', ['font', 'case', 'upper']), 'lowercase'),
  );

  const node = (
    (
      (document.getFiles()['core.json'] as Record<string, unknown>)
        .font as Record<string, unknown>
    ).case as Record<string, unknown>
  ).upper as Record<string, unknown>;
  expect(node.$value).toBeUndefined();
  expect((node.$extensions as Record<string, unknown>)[KEY]).toEqual({
    $type: 'textCase',
    $value: 'lowercase',
  });
  // The other vendor key survived the rewrite.
  expect((node.$extensions as Record<string, unknown>)['org.other']).toBe(true);
  expect(
    document.getToken(tokenId('core', ['font', 'case', 'upper']))?.value,
  ).toBe('lowercase');
});

test('addToken with codec provenance writes carrier form', () => {
  const document = codecDocument();
  document.hydrate({ 'core.json': {} });
  document.apply(
    addToken({
      id: tokenId('core', ['font', 'case', 'title']),
      path: ['font', 'case', 'title'],
      type: 'textCase',
      value: 'capitalize',
      set: 'core',
      codec: KEY,
    }),
  );
  const node = (
    (
      (document.getFiles()['core.json'] as Record<string, unknown>)
        .font as Record<string, unknown>
    ).case as Record<string, unknown>
  ).title as Record<string, unknown>;
  expect(node).toEqual({
    $extensions: { [KEY]: { $type: 'textCase', $value: 'capitalize' } },
  });
});

test('a rename rewrites an alias INSIDE a payload through its codec', () => {
  const document = codecDocument();
  document.hydrate({
    'core.json': {
      color: { base: { $type: 'color', $value: '#000' } },
      chip: carrier({ $type: 'textCase', $value: '{color.base}' }),
    },
  });
  document.apply(renamePath(['color', 'base'], ['color', 'brand']));

  const chip = (document.getFiles()['core.json'] as Record<string, unknown>)
    .chip as Record<string, unknown>;
  expect(chip.$value).toBeUndefined();
  expect((chip.$extensions as Record<string, unknown>)[KEY]).toEqual({
    $type: 'textCase',
    $value: '{color.brand}',
  });
});

test('a derivation codec reads codecSource — the formula survives a value edit', () => {
  // Payload = formula; value = computed. serialize solves the nearest step from an
  // incoming value, keeping base and ratio from the parsed payload.
  const scale: TokenCodec = {
    key: 'org.test.scale',
    materialize(payload) {
      const p = payload as { base: number; ratio: number; step: number };
      if (typeof p?.base !== 'number') return null;
      return {
        type: 'dimension',
        value: { value: p.base * p.ratio ** p.step, unit: 'rem' },
      };
    },
    serialize(token) {
      const prior = token.codecSource as {
        base: number;
        ratio: number;
        step: number;
      };
      const size = (token.value as { value: number }).value;
      return {
        base: prior.base,
        ratio: prior.ratio,
        step: Math.round(Math.log(size / prior.base) / Math.log(prior.ratio)),
      };
    },
  };
  const registry = createTokenCodecRegistry();
  registry.register(scale);
  const document = createDocument({ codecs: () => registry.list() });
  document.hydrate({
    'core.json': {
      lg: {
        $extensions: {
          'org.test.scale': { base: 1, ratio: 1.25, step: 1 },
        },
      },
    },
  });

  const token = document.getAllTokens()[0] as Token;
  expect(token.value).toEqual({ value: 1.25, unit: 'rem' });
  expect(token.codecSource).toEqual({ base: 1, ratio: 1.25, step: 1 });

  // 3rem snaps to the nearest step (1.25^5 ≈ 3.05): base and ratio survive the edit.
  document.apply(
    updateTokenValue(tokenId('core', ['lg']), { value: 3, unit: 'rem' }),
  );
  const node = (document.getFiles()['core.json'] as Record<string, unknown>)
    .lg as Record<string, unknown>;
  expect(
    (node.$extensions as Record<string, unknown>)['org.test.scale'],
  ).toEqual({ base: 1, ratio: 1.25, step: 5 });
});

// ── interchange ──────────────────────────────────────────────────────────────

test('interchangeFiles inlines carriers as plain tokens, untouched files pass by reference', () => {
  const files = {
    'core.json': { font: { case: { upper: upper() } } },
    'other.json': { plain: { $type: 'number', $value: 1 } },
  };
  const tokens = parseCollection(files, [textCodec]);
  const staged = interchangeFiles(files, tokens);

  const node = (
    (
      (staged['core.json'] as Record<string, unknown>).font as Record<
        string,
        unknown
      >
    ).case as Record<string, unknown>
  ).upper as Record<string, unknown>;
  expect(node.$type).toBe('textCase');
  expect(node.$value).toBe('uppercase');
  // The payload key is gone; the other vendor key survives.
  expect(node.$extensions).toEqual({ 'org.other': true });
  // Authored store untouched; carrier-free files pass through by reference.
  expect(
    (
      (
        (files['core.json'].font as Record<string, unknown>).case as Record<
          string,
          unknown
        >
      ).upper as Record<string, unknown>
    ).$value,
  ).toBeUndefined();
  expect(staged['other.json']).toBe(files['other.json']);

  // No codec tokens at all → identity.
  expect(interchangeFiles(files, [])).toBe(files);
});

// ── kernel wiring ────────────────────────────────────────────────────────────

test('the kernel pre-creates the codec service; late registration refreshes without a version bump', () => {
  const kernel = createKernel();
  kernel.document.hydrate({
    'core.json': { font: { case: { upper: upper() } } },
  });
  expect(kernel.document.getAllTokens()).toEqual([]);
  const version = kernel.document.getVersion();

  const codecs = kernel.services.get<TokenCodecService>(TOKEN_CODEC_SERVICE);
  codecs?.register(textCodec);
  expect(kernel.document.getAllTokens()).toHaveLength(1);
  // A registration is not an edit — nothing for a runner to persist.
  expect(kernel.document.getVersion()).toBe(version);

  expect(() => codecs?.register(textCodec)).toThrow(/already registered/);
});
