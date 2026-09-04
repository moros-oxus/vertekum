# Commands — contributing and extending

Extensions shape the command surface two ways, through the activation context:

```ts
ctx.commands.register(descriptor); // declare a NEW command
ctx.commands.extend(name, link); // join the chain of an EXISTING one
```

`register` contributes a whole verb — a descriptor with `name`, `description`,
`args`, `options`, and a `run` handler (the runner model, `--dry-run`/`--json`, and
the purity rules are documented with the CLI's contributed-commands page).

`extend` is this page's subject: the **command extension chain**, which lets an
extension specialize how an existing command applies its work — without replacing
the command, and without owning persistence.

## The chain model

A context object flows down the chain, carrying the original input and the current
(possibly amended) state. Each link decides for itself whether it applies, then does
exactly one of three things:

| A link may | How | Effect |
| --- | --- | --- |
| propose | return a proposal object | the context's `current` state advances; later links see it |
| pass | return `undefined` | nothing changes; the chain continues |
| refuse | throw an `Error` | the command fails with that message (exit `1` at the CLI) |

Three rules hold everywhere:

- **Links propose; they never write.** The command applies the outcome once, at the
  end — which is what keeps undo at one step per action, and makes a mid-chain
  refusal safe (nothing is half-applied).
- **Order is the config's `extensions: []` array.** Chains run in activation order;
  a consumer reorders extensions, not handlers.
- **Declaration is static.** A link may declare `options` (same shape as a
  descriptor's); they join the command's flag set at parse time, before any handler
  has seen a value.

Extending a name that is neither a registered command nor a declared extensible
point throws at activation — a typo is a loud startup error, not a chain nobody
consults.

## Extensible commands and their contracts

Each extensible command publishes the context its chain receives and the proposal
it accepts. Two contracts exist today.

### `token add` / `token set` — value preparation

Consulted before the missing-`--type` refusal and before the built-in short-form
transforms (`color`, `dimension`, `duration`), so a link can settle either the type
or the value. References and JSON objects never reach the chain — they pass
through untransformed, as the format specifies.

Context (`ValuePreparationContext`):

| Field | What it holds |
| --- | --- |
| `document` | the loaded document, read-only — walk groups and siblings to decide |
| `set`, `path` | where the token lands (`path` is the dotted path, split) |
| `type.explicit` | the author's `--type` flag, if any — always wins |
| `type.inherited` | the nearest group declaration (for `token set`: the token's current effective type) |
| `type.current` | what the chain has proposed so far |
| `value.original` | the raw argument, verbatim |
| `value.current` | the value as prepared so far (JSON already parsed) |

Proposal (`ValueProposal`): `{ type?, value? }` — partial proposals are idiomatic.
Propose a type alone and the built-in transform parses the value downstream ("let
the chain ride").

After the chain, the effective type is `explicit ?? proposed ?? inherited` — an
author's flag is never overridden by inference — and a chain-proposed type is
written onto the token only when it differs from the inheritance. The check gate
still validates whatever is stored: a wrong inference is refused loudly, never
written quietly.

### `build` — interchange presentation

Consulted once per token while the export run stages the interchange files every
exporter receives. A link proposes the node exporters will SEE — a custom-typed
value presented in a form the downstream tool renders — while the stored document
keeps its authored shape. With no links registered, staging is byte-identical.

Context (`InterchangePresentationContext`):

| Field | What it holds |
| --- | --- |
| `token` | the model token being staged (path, set, type, value) |
| `node.original` | the node as staged before the chain |
| `node.current` | what the chain has proposed so far |

Proposal: the replacement node (a plain `$type`/`$value` object). The consult runs
in the export core, so every client that exports — the CLI, a UI, a program calling
`runTargets` — sees one code path.

## The shape of a link

```ts
import type {
  CommandExtension,
  ValuePreparationContext,
  ValueProposal,
} from '@vertekum/core';

const link: CommandExtension<ValuePreparationContext, ValueProposal> = {
  handle(context) {
    if (context.type.explicit !== undefined) return undefined; // not ours
    // …decide from context.document / context.value.current…
    return { type: 'spacing', value: parsedEntries };
  },
};

// in the extension's activate(ctx):
ctx.commands.extend('token add', link);
ctx.commands.extend('token set', link);
```

One link typically composes several facets of the same knowledge: parse the
type's shorthand when the type is declared, infer the type from the tree and the
value's shape when it is not, refuse malformed input with the accepted forms, and
present the type at `build` so exporters render it. Declaring what the type's
values ARE stays a schema concern (a patch document, registered or configured);
the chain only teaches the verbs and the export how to HANDLE them.
