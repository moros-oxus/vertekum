# examples/schemas

Three routes to a token vocabulary, in one project. Schemas are **files**, named in
`vertekum.config.ts` rather than registered by an extension.

```
schemas/house.dfn          the house vocabulary, declared as grammar
schemas/house.json         built from it by `vertekum schema build`
schemas/color.json         extends a packaged schema by $ref
schemas/dtcg-tokens.json   ejected from @vertekum/schema-dtcg
```

Run `vertekum check` here; it passes. Then break something and run it again.

## The point: different schemas for different token sets

`semantic.json` is held to Atlassian's colour vocabulary. `house.json` is held to a vocabulary of
this project's own. Neither knows about the other, and `core.json` — the primitives — is held to
nothing but DTCG well-formedness. That is the usual split: a system governs the names people
consume, not every raw value behind them.

Mixing sources is just more entries. Nothing stops one set using Atlassian's colour, another using
Primer's spacing, and a third using something internal.

## Route 1 — a schema declared and built

`schemas/house.dfn` declares the whole vocabulary in one expression:

```dfn
emphasis = subtle | bold

root = color.text.[neutral | brand | success].<emphasis>
```

`vertekum schema build` (contributed by `@vertekum/schema-builder`) materializes it as
`schemas/house.json` — ordinary JSON Schema 2020-12, no Vertekum concepts in it at all, and
the only thing binding and `check` ever see. The built file carries a `$comment` stamp;
hand-edit it and remove the stamp to take ownership, and `schema build` will leave it alone.
`schema build --check` fails when a built file is stale — the CI guard.

```
$ vertekum token add color.text.bland.subtle '#000' --set house
refused — this change would introduce 1 error(s):
  error  vocabulary/unevaluatedProperties  /color/text 'bland' is not permitted — allowed: neutral, brand, success
```

## Route 2 — extending a published vocabulary

`schemas/color.json` is Atlassian's colour vocabulary, ejected and edited: one position added at
`color.text` granting the name `marketing`. The copy is yours; add the name where it belongs.

```
$ vertekum schema eject @vertekum/schema-atlassian/color.json ./schemas/color.json
```

An upstream Atlaskit change no longer flows into the copy — that is the trade of owning it: re-eject
and re-apply the edit (the diff is one position).

```
$ vertekum token add color.text.marketing '#0052CC' --set semantic   # ours — accepted
$ vertekum token add color.text.bland '#000' --set semantic          # refused
```

## Route 3 — ejecting

The DTCG format schema applies to every project, from a package core depends on. This project took
a copy so it can change it:

```
$ vertekum schema eject @vertekum/schema-dtcg/format.json ./schemas/dtcg-tokens.json
```

The ejected file is the published schema verbatim — draft-07, while the vocabularies here are
2020-12. Each binding is validated under the dialect its schema declares, so the mix is invisible.

The binding carries `id: 'dtcg-tokens'`, which makes it **replace** the built-in rather than layer a
second copy beside it — otherwise every well-formedness error would be reported twice.

Ejecting is the answer whenever composing costs more than it saves: a copy you own beats a clever
`$ref` you have to re-derive every time you read it.
