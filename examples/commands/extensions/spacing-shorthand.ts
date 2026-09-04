import {
  type CommandExtension,
  type Extension,
  type InterchangePresentationContext,
  SCHEMA_BINDING_SERVICE,
  type SchemaBindingService,
  type ValuePreparationContext,
  type ValueProposal,
} from '@vertekum/core';
import SPACING_PATCH from '../schemas/spacing.json';

/** `4px`, `0.25rem`, `-2px` — the short forms an entry may take. */
const DIMENSION = /^(-?\d*\.?\d+)(px|rem)$/;

/**
 * Value preparation — one link joining `token add` AND `token set`.
 *
 * With `--type spacing` (or a group declaring it) the link parses the shorthand. Without a type
 * it INFERS from what it can see: the raw value's shape, and the tree through `context.document`
 * (here, the inherited group type). Three outcomes, one per facet of the chain:
 *
 *   - propose type AND value ('0px 8px' under a dimension group → spacing, parsed array);
 *   - propose the type ALONE and let the chain ride ('8px' → dimension; the built-in parses it);
 *   - refuse, loudly (five entries is not a spacing).
 */
const prepare: CommandExtension<ValuePreparationContext, ValueProposal> = {
  handle(context) {
    const raw = context.value.current;
    if (typeof raw !== 'string') return undefined;
    const entries = raw.trim().split(/\s+/);
    if (!entries.every((e) => DIMENSION.test(e) || e.startsWith('{'))) {
      return undefined;
    }
    const parsed = () =>
      entries.map((entry) => {
        const match = DIMENSION.exec(entry);
        return match ? { value: Number(match[1]), unit: match[2] } : entry;
      });
    const refuse = () => {
      throw new Error(
        `'${raw}' has ${entries.length} entries — a spacing takes 1–4, each a dimension ('4px', '0.25rem') or a curly reference`,
      );
    };

    // The type is already spacing (flag or group): this link owns the short form outright.
    if ((context.type.explicit ?? context.type.inherited) === 'spacing') {
      if (entries.length > 4) refuse();
      return { value: parsed() };
    }
    // The author named some other type: not this link's business.
    if (context.type.explicit !== undefined) return undefined;

    // Inference: several entries under a dimension group is a spacing in short form.
    if (context.type.inherited === 'dimension' && entries.length >= 2) {
      if (entries.length > 4) refuse();
      return { type: 'spacing', value: parsed() };
    }
    // A single entry with no type anywhere: settle `dimension` and let the chain ride —
    // the built-in transform parses '8px' downstream.
    if (context.type.inherited === undefined && entries.length === 1) {
      return { type: 'dimension' };
    }
    return undefined;
  },
};

/**
 * Interchange presentation — the `build` chain. A `spacing` array is presented to exporters as a
 * `string` token carrying the joined shorthand, which terrazzo renders verbatim as one custom
 * property. The stored document keeps the typed array; only what exporters SEE changes.
 */
const present: CommandExtension = {
  handle(context) {
    const { token } = context as InterchangePresentationContext;
    if (token.type !== 'spacing' || !Array.isArray(token.value)) {
      return undefined;
    }
    const entries = token.value.map((entry) =>
      typeof entry === 'object' && entry !== null
        ? `${(entry as { value: number }).value}${(entry as { unit: string }).unit}`
        : String(entry),
    );
    return { $type: 'string', $value: entries.join(' ') };
  },
};

export const spacingShorthandExtension: Extension = {
  manifest: {
    id: 'example.spacing-shorthand',
    name: 'Spacing shorthand (command extension chain)',
  },
  activate(ctx) {
    // The type itself is a SCHEMA declaration — the same patch mechanism as any custom type.
    ctx.services
      .get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)
      ?.register({ match: '*', target: 'tokens', schema: SPACING_PATCH });
    // The chain: one link prepares values on the curation verbs, one presents at export.
    ctx.commands.extend('token add', prepare as CommandExtension);
    ctx.commands.extend('token set', prepare as CommandExtension);
    ctx.commands.extend('build', present);
  },
};
