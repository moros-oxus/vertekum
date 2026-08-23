# Expressions

An expression describes a **name tree**: which token names may exist beneath a
position, and in what order the nesting proceeds. Everything to the right of a
production's `=` is one of these forms, freely composed.

| Syntax                  | Form                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| [`a.b.c`](#nesting)     | nesting — one tree level per step                                |
| [`a \| b`](#alternation) | alternation — the set of permitted names                        |
| [`[ … ]`](#groups)      | grouping; groups may hold full sub-paths                         |
| [`<name>`](#references) | reference a local production                                     |
| [`<@name>`, `<@module/name>`](#references) | reference an imported production              |
| [`<name [a, b]>`](#pick-and-omit)  | **pick** — only the listed members                    |
| [`<name ![a, b]>`](#pick-and-omit) | **omit** — the set minus the listed members           |
| [`<name*>`, `[a \| b *]`](#open-sets) | **open set** — additions are permitted             |
| [`step?`](#optional-slots) | **optional slot** — the step may be skipped                   |
| [`100-900/100`, `16-64*1.25~4`, `(2-4)xs`](./scales.md) | a numeric scale, enumerated at build, optionally affixed — see [scales](./scales.md) |

## Nesting

`a.b.c` — each `.` step is one level of the name tree: the token path `a.b.c` and
nothing beside it.

```dfn
root = color.text.base
```

grants exactly one path: `color.text.base`.

## Alternation

`a | b | c` — the union: this position permits these names.

```dfn
role = brand | danger | neutral | success | warning
```

## Groups

`[ … ]` groups an expression, usually to alternate inside a path:

```dfn
root = color.[text | icon].base
```

grants `color.text.base` and `color.icon.base`.

A group's options may be full **sub-paths**, which is how one root states branches with
different shapes:

```dfn
root = color.[
    <property>.<role>
  | text.code.[comments | keywords | strings]
  ]
```

## References

| Form                | Resolves to                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| `<name>`            | the local production `name`.                                                    |
| `<@name>`           | an imported production: searched across every import; an imported module's **root** goes by the module's key (its basename, or its `use … as` alias). |
| `<@module/name>`    | qualified — that import's production alone.                                     |

An unqualified `<@name>` that two imports could satisfy is an error naming the fix:
qualify it as `<@module/name>`. The import model — keys, aliasing, fragments — is
[modules](./modules.md).

## Pick and omit

A reference may narrow the set it names: `[a, b]` **picks** only the listed members,
`![a, b]` **omits** them. Every listed member is validated against the set — a typo is
a build error (`'<scale>' has no member '600' to omit`), and numbers are valid members:

```dfn
use "./space.dfn"

root = space.[<scale> | negative.<scale ![0, 1000]>]
```

A member may itself be a **reference**, denoting every name of the set it names — set
algebra with sets as operands, validated member-by-member exactly like plain names
(and an open member `<x*>` is refused: an operand names a closed set):

```dfn
use "./fullcolors.dfn"

accent-only = <@fullcolors ![<@fullcolors/saturated>, white]>
```

A modified set is a **new** set: it never shares the source pattern's `$def` in the
built schema — narrowing a set and changing the set are the same act. Naming the
narrowed form derives a new denotation:

```dfn
limited-accents = <@accent-color [red, blue]>
```

## Open sets

`*` marks a position's set as **open**: names beyond the listed ones are permitted, and
every member — listed or added — takes the same tail.

```dfn
root = color.<color-role*>.value
```

grants `color.<any color-role, or any addition>.value`. The trailing `*` also works
inside a group: `[small | medium | large *]`.

`*` opens a set of **names**: the production (or group) it marks must be name-only —
names, scales, and alternations of them. Opening a set of sub-paths is a build error,
because an addition would have no well-defined shape to take. The shared tail is
exactly what makes additions meaningful; the emitted schema routes them accordingly
([emission](./emission.md#open-positions)).

## Optional slots

`?` marks a path step as skippable. The grant is the **slot-collapse lattice** — every
combination of present and skipped optional steps:

```dfn
root = <role>.<emphasis>?.<state>?
```

grants four shapes:

- `<role>`
- `<role>.<emphasis>`
- `<role>.<state>`
- `<role>.<emphasis>.<state>`

Order is preserved — `<state>` always follows `<emphasis>` when both appear; skipping
is the only freedom. This is how a vocabulary states "emphasis and state are optional
refinements" in one line instead of enumerating the lattice.

## Style: the root reads as the syntagm

State the high-level shape in the root and let unused slots collapse; give forks their
own named productions instead of nesting them inline:

```dfn
property = background | text | icon | border
role = brand | danger | neutral | success | warning
emphasis = subtle | bold
state = hovered | pressed

root = color.[
    <property>.<role>?.<emphasis>?.<state>?
  | <code>
  ]

code = text.code.[comments | keywords | strings]
```

The root is the sentence — a reader sees the whole grammar of the vocabulary at the top
of the file; the productions below are its glossary. Deep inline nesting states the
same tree while hiding its shape.
