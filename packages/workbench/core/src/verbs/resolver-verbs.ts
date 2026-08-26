import {
  addResolver,
  removeResolver,
  updateResolver,
} from '../document/commands';
import type { Document } from '../document/document';
import type { ResolverDocument, Source } from '../document/resolver-types';
import type { CommandDescriptor } from '../shell/types';
import { documentOf, requireArg } from './context';
import type { ResolverAddress } from './resolver-address';
import {
  closest,
  editDistance,
  resolverAddress,
  suggest,
} from './resolver-address';

/**
 * The resolver curation verbs — `vtk resolver <verb> [-s|-m <path>] [operands]`.
 *
 * Generic verbs over an ADDRESS PATH (designed in dialogue, 2026-08-26): the flag names which
 * branch of the resolver document the `/`-joined path walks, and depth comes from addressing, not
 * vocabulary. The model's symmetry decides which verbs apply where: named children (sets,
 * modifiers, contexts) get `add`/`remove`; the anonymous ordered source lists inside sets and
 * contexts get `push`/`pop`/`order`; every level gets `list`.
 *
 * Only `add` ever creates — every other verb refuses a missing path component with the closest
 * existing name, which is what confines typo-created paths to the one verb whose job is creating.
 * Set entries and sources are additionally anchored to real collection files, so the free-form
 * namespace is only modifier/context names, where `add` reports exactly what it created and warns
 * on a near-miss sibling.
 *
 * Handlers never write files and never print. They mutate the document (`updateResolver` carries a
 * cloned-and-edited doc); the runner persists and gates.
 */

const PLACEMENT = /^(.+)@\{(\d+)\}$/;

function fileOf(set: string): string {
  return `${set}.json`;
}

/** A cloned resolver doc to edit — `updateResolver` replaces wholesale, so never mutate the snapshot. */
function resolverDocOf(document: Document, name: string): ResolverDocument {
  const held = document.getResolvers().get(name);
  if (!held) {
    const names = [...document.getResolvers().keys()];
    throw new Error(`no resolver '${name}'${suggest(name, names)}`);
  }
  return structuredClone(held);
}

/** Guard: `<set>.json` must exist in the collection — sources are anchored to real files. */
function requireSetFile(document: Document, set: string): void {
  const known = document.getSets();
  if (!known.includes(set)) {
    throw new Error(
      `no token set file '${fileOf(set)}' in the collection — known sets: ${known.join(', ') || '(none)'}${suggest(set, known)}`,
    );
  }
}

/** ` — note: …` when a just-created name sits one or two edits from an existing sibling. */
function nearMissNote(
  name: string,
  siblings: Iterable<string>,
  kind: string,
): string {
  const near = closest(name, siblings);
  return near
    ? ` — note: existing ${kind} '${near}' is ${editDistance(name, near)} edit(s) away`
    : '';
}

/** Where a source-list verb (`push`/`pop`/`order`) lands: the list itself plus a printable label. */
function sourceListAt(
  doc: ResolverDocument,
  address: ResolverAddress,
): { list: Source[]; label: string } {
  if (address.branch === 'set') {
    const set = address.set as string;
    const entry = doc.sets[set];
    if (!entry) {
      throw new Error(
        `resolver '${address.resolver}' has no set '${set}'${suggest(set, Object.keys(doc.sets))}`,
      );
    }
    return { list: entry.sources, label: `${address.resolver}/${set}` };
  }
  const modifier = address.modifier as string;
  const held = doc.modifiers[modifier];
  if (!held) {
    throw new Error(
      `resolver '${address.resolver}' has no modifier '${modifier}'${suggest(modifier, Object.keys(doc.modifiers))}`,
    );
  }
  if (address.context === undefined) {
    throw new Error(
      'this verb targets a source list — address a set (-s [resolver/]set) or a context (-m [resolver/]modifier/context)',
    );
  }
  const context = held.contexts[address.context];
  if (!context) {
    throw new Error(
      `modifier '${modifier}' has no context '${address.context}'${suggest(address.context, Object.keys(held.contexts))}`,
    );
  }
  return {
    list: context,
    label: `${address.resolver}/${modifier}/${address.context}`,
  };
}

/** A source's display/addressing name: its set name for a file ref, null for an inline source. */
function sourceName(source: Source): string | null {
  const ref = (source as { $ref?: unknown }).$ref;
  return typeof ref === 'string' ? ref.replace(/\.json$/, '') : null;
}

/** An order entry's kind and name, or nulls for a ref shape the verbs do not know (index-only). */
function orderEntryName(ref: string): {
  kind: 'sets' | 'modifiers' | null;
  name: string | null;
} {
  const set = /^#\/sets\/(.+)$/.exec(ref);
  if (set) return { kind: 'sets', name: set[1] as string };
  const modifier = /^#\/modifiers\/(.+)$/.exec(ref);
  if (modifier) return { kind: 'modifiers', name: modifier[1] as string };
  return { kind: null, name: null };
}

function addressOf(
  ctx: Parameters<CommandDescriptor['run']>[0],
  bare: string | undefined,
): ResolverAddress | null {
  return resolverAddress(documentOf(ctx), {
    set: ctx.options.set,
    modifier: ctx.options.modifier,
    bare,
  });
}

const ADDRESS_OPTIONS = [
  {
    flag: '-s, --set <path>',
    description: 'address a set entry: [resolver/]set',
  },
  {
    flag: '-m, --modifier <path>',
    description: 'address a modifier or context: [resolver/]modifier[/context]',
  },
];

export const resolverVerbs: CommandDescriptor[] = [
  {
    name: 'resolver add',
    description:
      'create a resolver, a set entry (-s), or a context — with its modifier if missing (-m)',
    args: [
      {
        name: 'operand',
        required: false,
        description:
          'the resolver name (no flag), or the context source set (-m); none for -s',
      },
    ],
    options: ADDRESS_OPTIONS,
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, ctx.args.operand);
      if (!address) {
        throw new Error('nothing to add — name a resolver, or address -s/-m');
      }

      if (address.branch === 'resolver') {
        const name = address.resolver;
        const names = [...document.getResolvers().keys()];
        if (names.includes(name)) {
          throw new Error(`resolver '${name}' already exists`);
        }
        document.apply(addResolver(name));
        return {
          summary: `added resolver ${name}${nearMissNote(name, names, 'resolver')}`,
        };
      }

      const doc = resolverDocOf(document, address.resolver);

      if (address.branch === 'set') {
        if (ctx.args.operand !== undefined) {
          throw new Error(
            `unexpected operand '${ctx.args.operand}' — 'add -s' takes only the path`,
          );
        }
        const set = address.set as string;
        if (doc.sets[set]) {
          throw new Error(
            `resolver '${address.resolver}' already has set '${set}'`,
          );
        }
        requireSetFile(document, set);
        doc.sets[set] = { sources: [{ $ref: fileOf(set) }] };
        doc.resolutionOrder.push({ $ref: `#/sets/${set}` });
        document.apply(updateResolver(address.resolver, doc));
        return { summary: `added set ${set} to ${address.resolver}` };
      }

      // -m: a context, creating its modifier around it when missing. A modifier is never created
      // bare — empty-contexts is an error the runner's gate would refuse, so the first context
      // arrives in the same command (and becomes the default).
      const modifier = address.modifier as string;
      if (address.context === undefined) {
        throw new Error(
          `a modifier needs at least one context — address one: vtk resolver add -m ${address.resolver}/${modifier}/<context> <source>`,
        );
      }
      const source = requireArg(ctx, 'operand');
      requireSetFile(document, source);
      const held = doc.modifiers[modifier];
      if (!held) {
        const siblings = Object.keys(doc.modifiers);
        doc.modifiers[modifier] = {
          contexts: { [address.context]: [{ $ref: fileOf(source) }] },
          default: address.context,
        };
        doc.resolutionOrder.push({ $ref: `#/modifiers/${modifier}` });
        document.apply(updateResolver(address.resolver, doc));
        return {
          summary: `created modifier ${modifier} with context ${address.context} (default) in ${address.resolver}${nearMissNote(modifier, siblings, 'modifier')}`,
        };
      }
      if (held.contexts[address.context]) {
        throw new Error(
          `modifier '${modifier}' already has context '${address.context}'`,
        );
      }
      const siblings = Object.keys(held.contexts);
      held.contexts[address.context] = [{ $ref: fileOf(source) }];
      document.apply(updateResolver(address.resolver, doc));
      return {
        summary: `added context ${address.context} to ${address.resolver}/${modifier}${nearMissNote(address.context, siblings, 'context')}`,
      };
    },
  },

  {
    name: 'resolver remove',
    description:
      'remove a resolver, a set entry (-s), a modifier or a context (-m)',
    args: [
      {
        name: 'name',
        required: false,
        description: 'the resolver name (no flag); none with -s/-m',
      },
    ],
    options: ADDRESS_OPTIONS,
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, ctx.args.name);
      if (!address) {
        throw new Error(
          'nothing to remove — name a resolver, or address -s/-m',
        );
      }

      if (address.branch === 'resolver') {
        resolverDocOf(document, address.resolver); // existence guard, with suggestion
        document.apply(removeResolver(address.resolver));
        return {
          summary: `removed resolver ${address.resolver} — an export target still naming it will report export/unknown-composition on the next check`,
        };
      }

      const doc = resolverDocOf(document, address.resolver);

      if (address.branch === 'set') {
        const set = address.set as string;
        if (!doc.sets[set]) {
          throw new Error(
            `resolver '${address.resolver}' has no set '${set}'${suggest(set, Object.keys(doc.sets))}`,
          );
        }
        delete doc.sets[set];
        doc.resolutionOrder = doc.resolutionOrder.filter(
          (entry) => entry.$ref !== `#/sets/${set}`,
        );
        document.apply(updateResolver(address.resolver, doc));
        return { summary: `removed set ${set} from ${address.resolver}` };
      }

      const modifier = address.modifier as string;
      const held = doc.modifiers[modifier];
      if (!held) {
        throw new Error(
          `resolver '${address.resolver}' has no modifier '${modifier}'${suggest(modifier, Object.keys(doc.modifiers))}`,
        );
      }

      if (address.context === undefined) {
        delete doc.modifiers[modifier];
        doc.resolutionOrder = doc.resolutionOrder.filter(
          (entry) => entry.$ref !== `#/modifiers/${modifier}`,
        );
        document.apply(updateResolver(address.resolver, doc));
        return {
          summary: `removed modifier ${modifier} from ${address.resolver}`,
        };
      }

      if (!held.contexts[address.context]) {
        throw new Error(
          `modifier '${modifier}' has no context '${address.context}'${suggest(address.context, Object.keys(held.contexts))}`,
        );
      }
      // Last-context first: when a sole context is also the default, "remove the modifier" is the
      // actionable message, not "retarget the default".
      if (Object.keys(held.contexts).length === 1) {
        throw new Error(
          `'${address.context}' is the last context of '${modifier}' — remove the modifier instead: vtk resolver remove -m ${address.resolver}/${modifier}`,
        );
      }
      if (held.default === address.context) {
        throw new Error(
          `'${address.context}' is the default context of '${modifier}' — retarget first: vtk resolver default -m ${address.resolver}/${modifier}/<context>`,
        );
      }
      delete held.contexts[address.context];
      document.apply(updateResolver(address.resolver, doc));
      return {
        summary: `removed context ${address.context} from ${address.resolver}/${modifier}`,
      };
    },
  },

  {
    name: 'resolver push',
    description:
      'append sources to a set (-s) or context (-m) — comma-delimited set names',
    args: [
      {
        name: 'sources',
        description: 'comma-delimited set names, appended in order',
      },
    ],
    options: ADDRESS_OPTIONS,
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, undefined);
      if (!address || address.branch === 'resolver') {
        throw new Error(
          'push targets a source list — address a set (-s [resolver/]set) or a context (-m [resolver/]modifier/context)',
        );
      }
      const doc = resolverDocOf(document, address.resolver);
      const { list, label } = sourceListAt(doc, address);

      const names = requireArg(ctx, 'sources')
        .split(',')
        .map((name) => name.trim());
      if (names.some((name) => name === '')) {
        throw new Error(
          'empty source name — expected comma-delimited set names',
        );
      }
      for (const name of names) {
        requireSetFile(document, name);
        if (list.some((source) => sourceName(source) === name)) {
          throw new Error(`'${label}' already sources ${fileOf(name)}`);
        }
        list.push({ $ref: fileOf(name) });
      }
      document.apply(updateResolver(address.resolver, doc));
      return { summary: `pushed ${names.length} source(s) onto ${label}` };
    },
  },

  {
    name: 'resolver pop',
    description:
      'remove one source from a set (-s) or context (-m) — by index or set name, default the last',
    args: [
      {
        name: 'which',
        required: false,
        description: 'a source index or set name; the last source when omitted',
      },
    ],
    options: ADDRESS_OPTIONS,
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, undefined);
      if (!address || address.branch === 'resolver') {
        throw new Error(
          'pop targets a source list — address a set (-s [resolver/]set) or a context (-m [resolver/]modifier/context)',
        );
      }
      const doc = resolverDocOf(document, address.resolver);
      const { list, label } = sourceListAt(doc, address);
      if (list.length <= 1) {
        throw new Error(
          `'${label}' has ${list.length} source(s) — popping the last would leave it sourcing nothing; remove it instead`,
        );
      }

      const which = ctx.args.which;
      let index: number;
      if (which === undefined) {
        index = list.length - 1;
      } else if (/^\d+$/.test(which)) {
        index = Number(which);
        if (index >= list.length) {
          throw new Error(
            `index ${index} is out of range — '${label}' has ${list.length} source(s)`,
          );
        }
      } else {
        index = list.findIndex((source) => sourceName(source) === which);
        if (index === -1) {
          const known = list
            .map(sourceName)
            .filter((name): name is string => name !== null);
          throw new Error(
            `'${label}' has no source '${which}'${suggest(which, known)}`,
          );
        }
      }
      const [popped] = list.splice(index, 1);
      document.apply(updateResolver(address.resolver, doc));
      const name = popped ? (sourceName(popped) ?? '(inline)') : '';
      return { summary: `popped ${name} from ${label}` };
    },
  },

  {
    name: 'resolver order',
    description:
      "reorder the resolution order (no flag) or a source list (-s/-m): placements 'name@{2}[,…]', a move '1 3', or a swap '1 3 --swap'",
    args: [
      {
        name: 'target',
        required: false,
        description: 'the resolver name (no flag), else the first operand',
      },
      { name: 'a', required: false, description: 'operand' },
      { name: 'b', required: false, description: 'operand' },
    ],
    options: [
      ...ADDRESS_OPTIONS,
      {
        flag: '--swap',
        description: 'swap the two positions instead of moving',
      },
    ],
    run(ctx) {
      const document = documentOf(ctx);
      const positionals = [ctx.args.target, ctx.args.a, ctx.args.b].filter(
        (value): value is string => value !== undefined,
      );
      const flagged =
        ctx.options.set !== undefined || ctx.options.modifier !== undefined;
      const bare = flagged ? undefined : positionals.shift();
      const address = addressOf(ctx, bare);
      if (!address) {
        throw new Error('nothing to order — name a resolver, or address -s/-m');
      }

      const doc = resolverDocOf(document, address.resolver);
      // At the resolver level the ordered list is resolutionOrder; at -s/-m it is the sources.
      const target =
        address.branch === 'resolver'
          ? {
              list: doc.resolutionOrder as unknown[],
              label: address.resolver,
              nameAt: (item: unknown) =>
                orderEntryName((item as { $ref: string }).$ref),
            }
          : (() => {
              const { list, label } = sourceListAt(doc, address);
              return {
                list: list as unknown[],
                label,
                nameAt: (item: unknown) => ({
                  kind: null,
                  name: sourceName(item as Source),
                }),
              };
            })();
      const { list, label, nameAt } = target;

      const describe = () =>
        list
          .map((item) => {
            const { kind, name } = nameAt(item);
            if (name === null) return '(inline)';
            return kind ? `${kind}/${name}` : name;
          })
          .join(', ');

      const move = (from: number, to: number) => {
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
      };

      // A single non-numeric operand is a placement list — including malformed ones, so a typo'd
      // 'sem@0' reports "bad placement", not generic usage.
      const placements =
        positionals.length === 1 && !/^\d+$/.test(positionals[0] as string);
      if (placements) {
        if (ctx.options.swap === true) {
          throw new Error('--swap takes two indices, not placements');
        }
        for (const placement of (positionals[0] as string).split(',')) {
          const match = PLACEMENT.exec(placement.trim());
          if (!match) {
            throw new Error(
              `bad placement '${placement.trim()}' — expected name@{index}`,
            );
          }
          const [, raw, at] = match as unknown as [string, string, string];
          const to = Number(at);
          if (to >= list.length) {
            throw new Error(
              `index ${to} is out of range — '${label}' has ${list.length} item(s)`,
            );
          }
          // `sets/x` / `modifiers/x` disambiguates a name existing as both.
          const prefixed = /^(sets|modifiers)\/(.+)$/.exec(raw);
          const wantKind = prefixed
            ? (prefixed[1] as 'sets' | 'modifiers')
            : null;
          const wantName = prefixed ? (prefixed[2] as string) : raw;
          const matches = list
            .map((item, index) => ({ index, ...nameAt(item) }))
            .filter(
              (entry) =>
                entry.name === wantName &&
                (wantKind === null || entry.kind === wantKind),
            );
          if (matches.length === 0) {
            const known = list
              .map((item) => nameAt(item).name)
              .filter((name): name is string => name !== null);
            throw new Error(
              `'${label}' has no item '${wantName}'${suggest(wantName, known)}`,
            );
          }
          if (matches.length > 1) {
            throw new Error(
              `'${wantName}' is ambiguous in '${label}' — use sets/${wantName} or modifiers/${wantName}`,
            );
          }
          move((matches[0] as { index: number }).index, to);
        }
        document.apply(updateResolver(address.resolver, doc));
        return { summary: `order of ${label}: ${describe()}` };
      }

      if (
        positionals.length === 2 &&
        positionals.every((p) => /^\d+$/.test(p))
      ) {
        const [from, to] = positionals.map(Number) as [number, number];
        for (const index of [from, to]) {
          if (index >= list.length) {
            throw new Error(
              `index ${index} is out of range — '${label}' has ${list.length} item(s)`,
            );
          }
        }
        if (ctx.options.swap === true) {
          const held = list[from];
          list[from] = list[to];
          list[to] = held;
        } else {
          move(from, to);
        }
        document.apply(updateResolver(address.resolver, doc));
        return { summary: `order of ${label}: ${describe()}` };
      }

      throw new Error(
        "order takes placements ('name@{2}[,…]'), a move ('1 3'), or a swap ('1 3 --swap')",
      );
    },
  },

  {
    name: 'resolver default',
    description: "set a modifier's default context",
    args: [],
    options: [ADDRESS_OPTIONS[1] as { flag: string; description: string }],
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, undefined);
      if (address?.branch !== 'modifier' || address.context === undefined) {
        throw new Error(
          'default addresses a context — vtk resolver default -m [resolver/]modifier/context',
        );
      }
      const doc = resolverDocOf(document, address.resolver);
      const modifier = address.modifier as string;
      const held = doc.modifiers[modifier];
      if (!held) {
        throw new Error(
          `resolver '${address.resolver}' has no modifier '${modifier}'${suggest(modifier, Object.keys(doc.modifiers))}`,
        );
      }
      if (!held.contexts[address.context]) {
        throw new Error(
          `modifier '${modifier}' has no context '${address.context}'${suggest(address.context, Object.keys(held.contexts))}`,
        );
      }
      held.default = address.context;
      document.apply(updateResolver(address.resolver, doc));
      return {
        summary: `default of ${address.resolver}/${modifier} is now ${address.context}`,
      };
    },
  },

  {
    name: 'resolver list',
    description:
      'show resolvers, or the addressed level: sets/modifiers/order, contexts, sources',
    args: [
      {
        name: 'name',
        required: false,
        description: 'a resolver name; all resolvers when omitted',
      },
    ],
    options: ADDRESS_OPTIONS,
    run(ctx) {
      const document = documentOf(ctx);
      const address = addressOf(ctx, ctx.args.name);

      if (!address) {
        const resolvers = document.getResolvers();
        if (resolvers.size === 0) {
          return { summary: 'no resolvers', data: [] };
        }
        const data = [...resolvers.entries()].map(([name, doc]) => ({
          name,
          sets: Object.keys(doc.sets).length,
          modifiers: Object.keys(doc.modifiers).length,
        }));
        return {
          summary: data
            .map(
              (entry) =>
                `${entry.name} — ${entry.sets} set(s), ${entry.modifiers} modifier(s)`,
            )
            .join('\n'),
          data,
        };
      }

      const doc = resolverDocOf(document, address.resolver);

      if (address.branch === 'resolver') {
        const order = doc.resolutionOrder.map((entry) => {
          const { kind, name } = orderEntryName(entry.$ref);
          return kind ? `${kind}/${name}` : entry.$ref;
        });
        const modifiers = Object.entries(doc.modifiers).map(
          ([name, modifier]) =>
            `${name} (${Object.keys(modifier.contexts).length} context(s), default ${modifier.default ?? '(unset)'})`,
        );
        const lines = [
          `sets: ${Object.keys(doc.sets).join(', ') || '(none)'}`,
          `modifiers: ${modifiers.join(', ') || '(none)'}`,
          `order: ${order.join(', ') || '(empty)'}`,
        ];
        return {
          summary: lines.join('\n'),
          data: {
            sets: Object.keys(doc.sets),
            modifiers: Object.fromEntries(
              Object.entries(doc.modifiers).map(([name, modifier]) => [
                name,
                {
                  contexts: Object.keys(modifier.contexts),
                  default: modifier.default,
                },
              ]),
            ),
            order,
          },
        };
      }

      if (address.branch === 'modifier' && address.context === undefined) {
        const modifier = address.modifier as string;
        const held = doc.modifiers[modifier];
        if (!held) {
          throw new Error(
            `resolver '${address.resolver}' has no modifier '${modifier}'${suggest(modifier, Object.keys(doc.modifiers))}`,
          );
        }
        const lines = Object.entries(held.contexts).map(
          ([name, sources]) =>
            `${name} (${sources.length} source(s))${held.default === name ? ' [default]' : ''}`,
        );
        return {
          summary: `contexts: ${lines.join(', ')}`,
          data: {
            contexts: Object.keys(held.contexts),
            default: held.default,
          },
        };
      }

      const { list, label } = sourceListAt(doc, address);
      const sources = list.map((source) => sourceName(source) ?? '(inline)');
      return {
        summary: `sources of ${label}: ${sources.join(', ')}`,
        data: sources,
      };
    },
  },
];
