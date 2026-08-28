# Extension-held token data

Some token data is not a value but the thing a value — or a whole set of values — is
generated from: a ramp definition, a scale formula, a palette seed. That data lives in
`$extensions`, under a vendor key the owning extension chooses, on a **carrier**: a
node whose only member is `$extensions`. A conformant tool reads that as an empty
group and preserves it; the file stays valid DTCG throughout.

(Custom and compound **types** are a different concern with a different mechanism —
tokens carry them directly in `$type`/`$value`, declared by
[extending the DTCG schema](./schemas.md#extending-the-dtcg-schema).)

The extension that owns the key registers:

| Piece | Service | Purpose |
| --- | --- | --- |
| a token codec | `TOKEN_CODEC_SERVICE` | payload ⇄ token in the model |
| a payload schema | `SCHEMA_BINDING_SERVICE` | `check` validates the payload's shape, under the extension's own domain |
| optionally, CLI commands | `ctx.commands` | curation verbs for the extension's data |

## The codec

```ts
interface TokenCodec {
  /** The `$extensions` key this codec owns. Unique — a duplicate registration throws. */
  key: string;
  /** Stored payload → token fields, or null to leave the node a plain group. */
  materialize(
    payload: unknown,
    at: { set: string; path: string[] },
  ): { type: string; value: unknown; description?: string } | null;
  /** The inverse: the payload to store for this token. */
  serialize(token: Token): unknown;
}
```

`materialize` runs at parse. A carrier bearing the codec's key becomes an ordinary
`Token`, with `token.codec` set to the key and `token.codecSource` holding the payload
as parsed. Aliasing, resolution, the curation verbs, and exporters then treat it like
any other token. Returning `null` refuses the payload and leaves the node a plain
group — the schema binding is where a malformed payload becomes a diagnostic.

`serialize` runs on every write that touches the token: a value edit, a rename that
rewrites an alias inside the payload, a move. The store always returns to carrier
form. A **derivation codec** — one whose payload is a formula rather than the value —
reads `token.codecSource` for the parts a computed value cannot reproduce, and may
map an incoming value edit back onto the formula (an edit that *snaps to the scale*).

The carrier rule at parse is strict; everything it refuses is left as authored:

| Node shape | Outcome |
| --- | --- |
| only `$`-keys, one registered codec key | materialized via the codec |
| has non-`$` children | a group; the payload is inert data |
| has `$value`/`$ref` beside the key | an ordinary token; the key rides as a foreign extension |
| carries two registered codec keys | left a group |
| the codec returns `null` | left a group |

One boundary the model draws today: one carrier, one token. Payloads that generate
*many* tokens (a ramp producing ten stops) are the seam's intended future and not yet
expressible.

## Store form and interchange form

The document always writes **store form**: carrier nodes, conformant files.

Exporters receive the **interchange form**: `runTargets` applies
`interchangeFiles(files, tokens)` before any exporter runs, replacing each carrier
with the plain `$type`/`$value` node of its materialized token (in a clone — the
authored files are untouched). A tool that stages files verbatim, as the terrazzo
exporter does, therefore consumes real tokens.

Notes on the dialect:

- An alias into a carrier resolves in the model but reads as a reference to an empty
  group in a foreign tool.
- A carrier node's own `$description` is not modelled; the payload holds all data.
- The key appears in every consumer's files, so it should be treated as permanent.

## API summary

- `TOKEN_CODEC_SERVICE` / `TokenCodecService` — `register`, `get`, `list`,
  `subscribe`. Pre-created by the kernel; available to every extension at activation.
- `SCHEMA_BINDING_SERVICE` / `SchemaBindingService` — `register`, `list`.
  Pre-created likewise.
- `Token.codec`, `Token.codecSource` — provenance stamped at parse.
- `interchangeFiles(files, tokens)` — the exporter-side transform; call it directly
  when handing collection files to an external tool outside `runTargets`.
- `parseCollection(files, codecs?)`, `tokenNode(token, codecs?)` — the pure functions
  underneath, for drivers that bypass the kernel.
- `document.invalidateDerived()` — refreshes the derived token view after a codec
  registers post-hydration; wired automatically in `createKernel`.
