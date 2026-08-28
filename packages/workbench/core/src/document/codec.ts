import type { Token } from './types';

/**
 * Extension-held token data (designed in dialogue, 2026-08-26).
 *
 * A custom-typed token — one no DTCG `$type` can carry — is STORED as a node whose only member is
 * `$extensions`: to every conformant tool that is an empty group, and `$extensions` is the one
 * channel the spec obligates tools to preserve. The file stays 100% conformant DTCG; the dialect
 * lives entirely in the payload under a vendor key the owning extension chooses.
 *
 * A codec is that extension's read/write mechanics, registered into the kernel: `materialize`
 * turns the stored payload into an ordinary token in the in-memory model (so aliasing, resolution,
 * verbs, exporters, and the UI see nothing special), and `serialize` is the inverse the document's
 * write path calls to keep the store conformant. Custom types are the first tenant; anything an
 * extension holds as token-shaped data (ramp definitions, scale builders…) rides the same seam.
 */
export interface TokenCodec {
  /** The `$extensions` key this codec owns. Unique — registering a duplicate throws. */
  key: string;
  /**
   * Stored payload → token fields, or null to leave the node a plain group. The codec owns its
   * payload's shape entirely; core never interprets it.
   */
  materialize(
    payload: unknown,
    at: { set: string; path: string[] },
  ): { type: string; value: unknown; description?: string } | null;
  /**
   * The inverse: the payload to store for this token. A derivation codec — one whose payload is a
   * formula rather than the value itself — reads `token.codecSource` (the payload as parsed,
   * carried with the token) for the parts a computed value cannot reproduce.
   */
  serialize(token: Token): unknown;
}

export interface TokenCodecService {
  register(codec: TokenCodec): void;
  get(key: string): TokenCodec | undefined;
  list(): TokenCodec[];
  /** Notifies on registration — the document invalidates its derived views through this. */
  subscribe(listener: () => void): () => void;
}

/** The well-known service key extensions reach the registry under (`ctx.services.get(...)`). */
export const TOKEN_CODEC_SERVICE = 'token-codec';

/** The kernel pre-creates this — core itself consumes codecs, unlike purely-contributed services. */
export function createTokenCodecRegistry(): TokenCodecService {
  const byKey = new Map<string, TokenCodec>();
  const listeners = new Set<() => void>();
  let snapshot: TokenCodec[] | null = null;
  return {
    register(codec) {
      if (byKey.has(codec.key)) {
        throw new Error(
          `a token codec for '${codec.key}' is already registered — one extension owns a key`,
        );
      }
      byKey.set(codec.key, codec);
      snapshot = null;
      for (const listener of listeners) listener();
    },
    get(key) {
      return byKey.get(key);
    },
    list() {
      if (snapshot === null) snapshot = [...byKey.values()];
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
