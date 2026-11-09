import {
  dtcg,
  type ExporterInput,
  exportPath,
  modifierOwners,
  ROOT_TOKEN,
  type Token,
} from '@vertekum/core';

/**
 * The Figma-shaped model — the artifact, and the contract.
 *
 * A resolved view of one composition in Figma's own vocabulary: collections with modes,
 * variables with per-mode values and alias edges, and styles (Figma is variables AND styles).
 * The topology mirrors the resolver: each SET becomes a single-mode collection; each MODIFIER
 * becomes a collection whose contexts are its modes. The composition IS the topology.
 *
 * Every variable carries both the Figma-typed value (`valuesByMode`) and the verbatim DTCG
 * `source` — dialect writers consume the lossy half; a consumer that understands the model
 * (a Figma plugin, an agent) gets the lossless half.
 */

/**
 * The contract version: names the model's SHAPE (what `model.schema.json` accepts), not a package
 * release or token content. `draft.NN` while the shape is unstable; `YYYY.MM` once declared stable.
 * The schema is closed, so ANY shape change — an added optional field included — takes a new
 * version, as does a change in what a field's values MEAN (draft.06: a line-height variable holds
 * px). A version is spent when a package releases it.
 */
export const MODEL_VERSION = 'draft.06';

export type FigmaType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface FigmaVariable {
  /** Slash-joined token path — Figma's grouping separator. */
  name: string;
  type: FigmaType;
  /** Figma-typed value per mode: COLOR `{r,g,b,a}` floats, FLOAT unitless px, string, boolean. */
  valuesByMode: Record<string, unknown>;
  /** Per-mode alias target (slash name). An alias wins over the value for that mode. */
  alias?: Record<string, string>;
  /** The authored DTCG notation, verbatim — the lossless half. */
  source?: { $type: string; $value: unknown };
  /**
   * Per mode, the source file (set = file, without `.json`) its value came from — where an edit
   * made in the design tool belongs when it flows back.
   */
  sources?: Record<string, string>;
  /** DTCG `$deprecated`: the reason, or `""` when none was given. Absent = not deprecated. */
  deprecated?: string;
  /** Reserved: nothing populates these yet; the schema keeps their seat. */
  scopes: string[];
  codeSyntax: Record<string, string>;
}

export interface FigmaCollection {
  name: string;
  /** Mode names, default first. Single-mode collections have `['default']`. */
  modes: string[];
  variables: FigmaVariable[];
  /**
   * Where each mode came from, when several compositions were merged into this collection —
   * so a consumer never parses mode names. Absent when the collection has one composition.
   */
  modeSources?: Record<string, { composition: string; context?: string }>;
}

export interface FigmaStyleProperty {
  property: string;
  /** Resolved value (CSS-ish primitive). */
  value: unknown;
  /** Bound member variable (slash name), when the member was authored as a reference. */
  variable?: string;
}

export interface FigmaStyle {
  kind: 'text' | 'effect';
  name: string;
  properties: FigmaStyleProperty[];
  source: { $type: string; $value: unknown };
  /** DTCG `$deprecated`: the reason, or `""` when none was given. Absent = not deprecated. */
  deprecated?: string;
}

export interface FigmaModel {
  version: typeof MODEL_VERSION;
  source: {
    /** The target that produced this artifact — its identity to a consumer. */
    target?: string;
    /** Every composition it holds, in configured order. */
    compositions: string[];
    generator: string;
    notices: string[];
    /**
     * `sha256:<hex>` of the model's content — its collections and styles, never this `source`
     * block — so two models compare equal exactly when a design file would hold the same thing.
     */
    fingerprint?: string;
    /**
     * The "not available" sentinels, when the model has any: a merged collection's variable that
     * a composition lacks aliases, in that composition's modes, the sentinel of its type — a
     * visible marker instead of a blank, and a signal for write-back (still aliased = no token for
     * that composition; changed = a new one). Named here so a consumer never parses names.
     */
    notAvailable?: {
      collection: string;
      variables: Partial<Record<FigmaType, string>>;
    };
  };
  collections: FigmaCollection[];
  styles: FigmaStyle[];
}

/**
 * A custom-type model contributor (config-passed via the exporter's `options.types`): maps ONE
 * mode-value of a token to variable atoms. `suffix` extends the token's path (per-side unfolds);
 * an atom may carry a concrete `value` or an `alias` (dotted token path).
 */
export type TypeContributor = (
  value: unknown,
  token: Token,
) => Array<{
  suffix?: string;
  type: FigmaType;
  value?: unknown;
  alias?: string;
}>;

export interface BuildModelOptions {
  composition?: string;
  types?: Record<string, TypeContributor>;
  /**
   * Path → the modifier whose collection holds it, decided ACROSS every composition merged into
   * one model (so a path lands in one collection for all of them). Omitted: derived from this
   * composition's resolver alone.
   */
  claimed?: Map<string, string>;
}

/**
 * Per variable (and per style, keyed `style:<name>`), per mode: the files its value depends on —
 * its own source file, plus every file a FLATTENED reference passes through (an alias kept as an
 * alias depends only on its own file: Figma resolves it per mode). What the merge compares to
 * decide shared vs per-composition — structure, never values.
 */
export type ModelDeps = Map<string, Record<string, string>>;

const GENERATOR = '@vertekum/ext-export-figma';

/** Types whose per-token handling is built in (beyond these, `options.types` or a notice). */
const TEXT_TYPES = new Set([
  'string',
  'fontFamily',
  'textCase',
  'textDecoration',
  'strokeStyle',
]);

/** A group's own value (`$root`) is named by the group's path — never a name segment. */
const slash = (path: string[]): string => exportPath(path).join('/');
const dotToSlash = (dotted: string): string => slash(dotted.split('.'));

/** Every whole-value reference inside a value (composites included). */
function referencesIn(value: unknown, out: string[] = []): string[] {
  if (dtcg.tokens.isReference(value)) {
    out.push(dtcg.tokens.referenceToPath(value));
  } else if (Array.isArray(value)) {
    for (const item of value) referencesIn(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) referencesIn(item, out);
  }
  return out;
}

/**
 * A composite member's VALUE: a member authored as a reference (`{font.family.sans}`) is followed
 * through the bundle to what it holds. Bundles keep references; a style property needs the value
 * (its variable binding is recorded separately).
 */
function deref(value: unknown, bundle: Map<string, Token>): unknown {
  let held = value;
  const seen = new Set<string>();
  while (dtcg.tokens.isReference(held)) {
    const path = dtcg.tokens.referenceToPath(held);
    if (seen.has(path)) return held;
    seen.add(path);
    const target = bundle.get(path) ?? bundle.get(`${path}.${ROOT_TOKEN}`);
    if (!target) return held;
    held = target.value;
  }
  return held;
}

/** The files a value's reference chain passes through, in a bundle (cycle-guarded). */
function chainFiles(
  value: unknown,
  bundle: Map<string, Token>,
  files: Set<string> = new Set(),
  seen: Set<string> = new Set(),
): Set<string> {
  for (const path of referencesIn(value)) {
    if (seen.has(path)) continue;
    seen.add(path);
    const target = bundle.get(path) ?? bundle.get(`${path}.${ROOT_TOKEN}`);
    if (!target) continue;
    files.add(target.set ?? 'tokens');
    chainFiles(target.sourceValue ?? target.value, bundle, files, seen);
  }
  return files;
}

function isDimension(value: unknown): value is { value: number; unit: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { value?: unknown }).value === 'number' &&
    typeof (value as { unit?: unknown }).unit === 'string'
  );
}

function px(value: { value: number; unit: string }): number {
  return value.unit === 'rem' || value.unit === 'em'
    ? value.value * 16
    : value.value;
}

async function figmaColor(value: unknown): Promise<unknown> {
  // A value that isn't a colour (an unresolved reference) converts to nothing — never a throw.
  const srgb = (await dtcg.values.convertColor(value, 'srgb')) as
    | { components?: number[]; alpha?: number }
    | undefined;
  if (!Array.isArray(srgb?.components)) return undefined;
  const [r, g, b] = srgb.components;
  return { r, g, b, a: srgb.alpha ?? 1 };
}

/** One token's Figma type + converted value, or undefined when the type is not variable-shaped. */
async function convert(
  type: string,
  value: unknown,
): Promise<{ type: FigmaType; value: unknown } | undefined> {
  if (type === 'color') {
    return { type: 'COLOR', value: await figmaColor(value) };
  }
  if (type === 'dimension' && isDimension(value)) {
    return { type: 'FLOAT', value: px(value) };
  }
  if (type === 'duration' && isDimension(value)) {
    return { type: 'FLOAT', value: value.value };
  }
  if (
    type === 'number' ||
    (type === 'fontWeight' && typeof value === 'number')
  ) {
    return typeof value === 'number'
      ? { type: 'FLOAT', value }
      : { type: 'STRING', value: String(value) };
  }
  if (type === 'fontWeight') return { type: 'STRING', value: String(value) };
  if (type === 'fontFamily') {
    return {
      type: 'STRING',
      value: Array.isArray(value) ? String(value[0]) : String(value),
    };
  }
  if (TEXT_TYPES.has(type) && typeof value === 'string') {
    return { type: 'STRING', value };
  }
  if (typeof value === 'boolean') return { type: 'BOOLEAN', value };
  return undefined;
}

/** A token's deprecation in the model's form: the reason, `""` for a bare `true`. */
function deprecationOf(
  token: Token,
): { deprecated: string } | Record<string, never> {
  if (token.deprecated === undefined) return {};
  return {
    deprecated: typeof token.deprecated === 'string' ? token.deprecated : '',
  };
}

/**
 * Whether a design tool binds this text-style property to a variable of this type, so the style
 * follows the mode. A bound letter spacing or line height is read as pixels, so those bind only
 * when the value is px — a line height is px when its variable was translated (`lineHeights`),
 * and a multiplier otherwise. Text case and decoration can't bind at all.
 */
const BINDABLE: Record<string, FigmaType> = {
  'font-family': 'STRING',
  'font-size': 'FLOAT',
  'font-weight': 'FLOAT',
  'letter-spacing': 'FLOAT',
  'line-height': 'FLOAT',
};

export function bindable(
  property: string,
  type: FigmaType,
  value: unknown,
): boolean {
  if (BINDABLE[property] !== type) return false;
  if (property === 'letter-spacing' || property === 'line-height') {
    return typeof value === 'string' && value.trim().endsWith('px');
  }
  return true;
}

/** Typography members → text-style properties; shadow layers → effect-style properties. */
const TYPOGRAPHY_MEMBERS: Record<string, string> = {
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  letterSpacing: 'letter-spacing',
  lineHeight: 'line-height',
  textCase: 'text-case',
  textDecoration: 'text-decoration',
};

function styleValue(member: unknown): unknown {
  if (isDimension(member)) return `${member.value}${member.unit}`;
  if (Array.isArray(member)) return member.map(styleValue).join(', ');
  return member;
}

/**
 * Which modifier holds each path: the one resolved LAST among its owners (it wins at resolution;
 * a variable lives in one collection). Structure only — see `modifierOwners`.
 */
export function claimsOf(
  resolver: ExporterInput['resolver'],
  tokens: Token[],
  notices: string[],
): Map<string, string> {
  const claimed = new Map<string, string>();
  for (const [path, owners] of modifierOwners(resolver, tokens)) {
    const winner = owners[owners.length - 1];
    if (winner === undefined) continue;
    claimed.set(path, winner);
    if (owners.length > 1) {
      notices.push(
        `'${path}' is overridden by ${owners.map((o) => `'${o}'`).join(' and ')} — modelled under '${winner}', resolved last`,
      );
    }
  }
  return claimed;
}

type Bundle = Map<string, Token>;

/** A line-height token's variable, translated to px. */
interface LineHeight {
  /** px per mode, 2 decimals. */
  byMode: Map<string, number>;
  /** px in the default bundle — the style's plain value. */
  plain: number;
  /** The text styles whose `lineHeight` references the token (their font size is a dependency). */
  styles: Token[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The token a reference names — a group reference reaches its `$root`. */
function referenced(value: unknown, bundle: Bundle): Token | undefined {
  if (!dtcg.tokens.isReference(value)) return undefined;
  const path = dtcg.tokens.referenceToPath(value);
  return bundle.get(path) ?? bundle.get(`${path}.${ROOT_TOKEN}`);
}

/**
 * Line heights: a token a text style's `lineHeight` references holds a multiplier, while a design
 * tool reads a line height bound to a variable as px. So the token's variable holds the token
 * TRANSLATED — the referencing style's font size × the multiplier, per mode, 2 decimals — when
 * that is well-defined. Otherwise it stays the multiplier (unbound, as before) and a notice says
 * why. The token keeps its value; the variable's `source` still says what it holds.
 */
function lineHeights(
  allTokens: Bundle,
  base: Bundle,
  modesOf: (path: string) => Array<{ mode: string; bundle: Bundle }>,
  allBundles: Bundle[],
  notices: string[],
): Map<string, LineHeight> {
  const referencing = new Map<string, Token[]>();
  for (const token of allTokens.values()) {
    if (token.type !== 'typography') continue;
    const raw = token.sourceValue ?? token.value;
    if (!raw || typeof raw !== 'object') continue;
    const target = referenced(
      (raw as Record<string, unknown>).lineHeight,
      allTokens,
    );
    if (!target) continue;
    const key = target.path.join('.');
    referencing.set(key, [...(referencing.get(key) ?? []), token]);
  }

  const indexes = new Map<Bundle, ReturnType<typeof dtcg.tokens.indexByPath>>();
  const resolved = (token: Token, bundle: Bundle): unknown => {
    const held = bundle.get(token.path.join('.')) ?? token;
    if (!dtcg.tokens.isReference(held.value)) return held.value;
    let index = indexes.get(bundle);
    if (!index) {
      index = dtcg.tokens.indexByPath([...bundle.values()]);
      indexes.set(bundle, index);
    }
    return dtcg.tokens.resolveValue(held, index);
  };
  /** The one font size (px) the styles share in a bundle; a string says why there isn't one. */
  const sizeIn = (styles: Token[], bundle: Bundle): number | string => {
    const sizes = new Set<number>();
    for (const style of styles) {
      const held = bundle.get(style.path.join('.')) ?? style;
      const member = (held.value as Record<string, unknown> | undefined)
        ?.fontSize;
      const size = deref(member, bundle);
      if (!isDimension(size)) {
        return "is the line height of a style whose font size isn't a dimension";
      }
      sizes.add(round2(px(size)));
    }
    const [only] = sizes;
    return sizes.size === 1 && only !== undefined
      ? only
      : 'is the line height of styles with different font sizes';
  };

  const out = new Map<string, LineHeight>();
  for (const [key, styles] of referencing) {
    const token = allTokens.get(key);
    if (!token) continue;
    const name = exportPath(token.path).join('.');
    const keep = (why: string) =>
      notices.push(`'${name}' ${why} — kept as a multiplier, not bound`);
    const modes = modesOf(key);
    const covered = new Set(modes.map((m) => m.bundle));
    const baseSize = sizeIn(styles, base);
    if (typeof baseSize === 'string') {
      keep(baseSize);
      continue;
    }
    // A size that varies along an axis the variable has no modes for can't be one value per mode.
    if (
      allBundles.some(
        (bundle) => !covered.has(bundle) && sizeIn(styles, bundle) !== baseSize,
      )
    ) {
      keep(
        'is a line height whose font size varies where its variable has no modes',
      );
      continue;
    }
    const byMode = new Map<string, number>();
    let why: string | undefined;
    for (const { mode, bundle } of modes) {
      const size = sizeIn(styles, bundle);
      const multiplier = resolved(token, bundle);
      if (typeof size === 'string') why = size;
      else if (typeof multiplier !== 'number') why = "isn't a number";
      else byMode.set(mode, round2(size * multiplier));
      if (why !== undefined) break;
    }
    if (why !== undefined) {
      keep(why);
      continue;
    }
    const multiplier = resolved(token, base);
    if (typeof multiplier !== 'number') continue;
    out.set(key, { byMode, plain: round2(baseSize * multiplier), styles });
  }
  return out;
}

/** Build the Figma-shaped model from a resolved composition. */
export async function buildModel(
  input: ExporterInput,
  options: BuildModelOptions = {},
): Promise<FigmaModel> {
  return (await buildModelWithDeps(input, options)).model;
}

/**
 * The model, plus what each value depends on (for the merge).
 *
 * `input.base` is the default selection; `input.variants` are the fully-resolved non-default
 * contexts. A token belongs to a MODIFIER's collection when a file one of that modifier's contexts
 * references defines it — whether or not its value differs today; everything else lands in the
 * collection of the resolver SET whose file defines it. Values are read per mode from the
 * corresponding resolved bundle.
 */
export async function buildModelWithDeps(
  input: ExporterInput,
  options: BuildModelOptions = {},
): Promise<{ model: FigmaModel; deps: ModelDeps }> {
  const notices: string[] = [];
  const deps: ModelDeps = new Map();
  const model: FigmaModel = {
    version: MODEL_VERSION,
    source: {
      compositions: options.composition ? [options.composition] : [],
      generator: GENERATOR,
      notices,
    },
    collections: [],
    styles: [],
  };

  const basePaths = new Map(input.base.map((t) => [t.path.join('.'), t]));

  // Modifier axes: context order as declared, default first; per-context resolved bundles.
  const axes = Object.entries(input.resolver.modifiers).map(
    ([modifier, mod]) => {
      const contexts = Object.keys(mod.contexts);
      const defaultContext = mod.default ?? contexts[0] ?? 'default';
      const ordered = [
        defaultContext,
        ...contexts.filter((c) => c !== defaultContext),
      ];
      const bundles = new Map<string, Map<string, Token>>();
      bundles.set(defaultContext, basePaths);
      for (const variant of input.variants) {
        if (variant.modifier !== modifier) continue;
        bundles.set(
          variant.context,
          new Map(variant.tokens.map((t) => [t.path.join('.'), t])),
        );
      }
      return { modifier, contexts: ordered, bundles };
    },
  );

  // Ownership by structure: the caller's cross-composition decision, else this resolver's own.
  // A path claimed by a modifier this composition doesn't declare stays with its set here.
  const claimed = new Map(
    [
      ...(options.claimed ?? claimsOf(input.resolver, input.tokens, notices)),
    ].filter(([, modifier]) => modifier in input.resolver.modifiers),
  );

  // First pass — every variable that will exist (name → type), so alias edges and style
  // bindings can check their targets.
  const variableNames = new Map<string, FigmaType>();
  const atomsOf = async (
    token: Token,
    value: unknown,
  ): Promise<
    | Array<{
        suffix?: string;
        type: FigmaType;
        value?: unknown;
        alias?: string;
      }>
    | undefined
  > => {
    const contributor = options.types?.[token.type];
    if (contributor) return contributor(value, token);
    const converted = await convert(token.type, value);
    return converted
      ? [{ type: converted.type, value: converted.value }]
      : undefined;
  };
  const nameOf = (token: Token, suffix?: string): string =>
    suffix ? `${slash(token.path)}/${suffix}` : slash(token.path);

  const allTokens = new Map<string, Token>(basePaths);
  for (const variant of input.variants) {
    for (const token of variant.tokens) {
      const path = token.path.join('.');
      if (!allTokens.has(path)) allTokens.set(path, token);
    }
  }
  // A token's type comes from what it RESOLVES to: a reference (`"{font.weight.bold}"`) is a
  // string until it's followed, and typing it as one would refuse every binding to it.
  const allIndex = dtcg.tokens.indexByPath([...allTokens.values()]);
  for (const token of allTokens.values()) {
    if (token.type === 'typography' || token.type === 'shadow') continue;
    // A reference that doesn't resolve here keeps its raw value, typed as before.
    const value = dtcg.tokens.isReference(token.value)
      ? (dtcg.tokens.resolveValue(token, allIndex) ?? token.value)
      : token.value;
    const atoms = await atomsOf(token, value);
    if (!atoms) continue;
    for (const atom of atoms) {
      variableNames.set(nameOf(token, atom.suffix), atom.type);
    }
  }

  // The modes a path's variable takes: its modifier's contexts, else the set's one mode.
  const modesOf = (path: string) => {
    const axis = axes.find((a) => a.modifier === claimed.get(path));
    return axis
      ? axis.contexts.map((context) => ({
          mode: context,
          bundle: axis.bundles.get(context) ?? basePaths,
        }))
      : [{ mode: 'default', bundle: basePaths }];
  };
  const translated = lineHeights(
    allTokens,
    basePaths,
    modesOf,
    [...new Set([basePaths, ...axes.flatMap((a) => [...a.bundles.values()])])],
    notices,
  );

  // Variable construction for one token across a mode set.
  const buildVariables = async (
    token: Token,
    modes: Array<{ mode: string; bundle: Map<string, Token> }>,
  ): Promise<FigmaVariable[] | 'style' | undefined> => {
    if (token.type === 'typography' || token.type === 'shadow') {
      buildStyle(token);
      return 'style';
    }
    const byName = new Map<string, FigmaVariable>();
    const lineHeight = translated.get(token.path.join('.'));
    for (const { mode, bundle } of modes) {
      const held = bundle.get(token.path.join('.')) ?? token;
      const raw = held.value;
      if (lineHeight) {
        // A line height translated to px: a value of its own, never an alias. It depends on
        // its own chain and on every file the styles' font size reaches.
        const name = nameOf(token);
        const variable = byName.get(name) ?? {
          name,
          type: 'FLOAT' as const,
          valuesByMode: {},
          source: { $type: token.type, $value: token.value },
          ...deprecationOf(held),
          scopes: [],
          codeSyntax: {},
        };
        byName.set(name, variable);
        const value = lineHeight.byMode.get(mode);
        if (value !== undefined) variable.valuesByMode[mode] = value;
        const file = held.set ?? 'tokens';
        variable.sources = { ...variable.sources, [mode]: file };
        const files = chainFiles(raw, bundle, new Set([file]));
        for (const style of lineHeight.styles) {
          const heldStyle = bundle.get(style.path.join('.')) ?? style;
          files.add(heldStyle.set ?? 'tokens');
          chainFiles(
            (heldStyle.value as Record<string, unknown>).fontSize,
            bundle,
            files,
          );
        }
        deps.set(name, {
          ...deps.get(name),
          [mode]: [...files].sort().join('|'),
        });
        continue;
      }
      // A whole-value curly reference: alias when the target is a variable, else materialize.
      let aliasTarget: string | undefined;
      let value = raw;
      if (dtcg.tokens.isReference(raw)) {
        const target = dotToSlash(dtcg.tokens.referenceToPath(raw));
        if (variableNames.has(target)) aliasTarget = target;
        value = dtcg.tokens.resolveValue(
          held,
          dtcg.tokens.indexByPath([...bundle.values()]),
        );
      }
      const atoms = await atomsOf(held, value);
      if (!atoms) {
        if (mode === modes[0]?.mode) return undefined;
        continue;
      }
      for (const atom of atoms) {
        const name = nameOf(token, atom.suffix);
        let variable = byName.get(name);
        if (!variable) {
          variable = {
            name,
            type: atom.type,
            valuesByMode: {},
            source: { $type: token.type, $value: token.value },
            // One variable, one deprecation: the token's, as the first mode holds it.
            ...deprecationOf(held),
            scopes: [],
            codeSyntax: {},
          };
          byName.set(name, variable);
        }
        if (atom.value !== undefined) variable.valuesByMode[mode] = atom.value;
        const atomAlias =
          atom.alias !== undefined ? dotToSlash(atom.alias) : aliasTarget;
        const aliased = atomAlias !== undefined && variableNames.has(atomAlias);
        if (aliased) {
          variable.alias = { ...variable.alias, [mode]: atomAlias };
        }
        // Where this mode's value lives — what a write-back edits.
        const file = held.set ?? 'tokens';
        variable.sources = { ...variable.sources, [mode]: file };
        // What it depends on: its own file, plus a flattened reference's chain.
        const files = aliased
          ? new Set([file])
          : chainFiles(held.sourceValue ?? raw, bundle, new Set([file]));
        deps.set(name, {
          ...deps.get(name),
          [mode]: [...files].sort().join('|'),
        });
      }
    }
    return [...byName.values()];
  };

  const buildStyle = (token: Token): void => {
    const value = token.value;
    const own = new Set([token.set ?? 'tokens']);
    const recordDeps = (files: Set<string>) =>
      deps.set(`style:${slash(token.path)}`, {
        default: [...files].sort().join('|'),
      });
    const raw = token.sourceValue ?? value;
    if (
      token.type === 'typography' &&
      value &&
      typeof value === 'object' &&
      raw &&
      typeof raw === 'object'
    ) {
      const authoredMembers = raw as Record<string, unknown>;
      const resolved = value as Record<string, unknown>;
      const properties: FigmaStyleProperty[] = [];
      const bound = new Set<string>();
      for (const [member, property] of Object.entries(TYPOGRAPHY_MEMBERS)) {
        if (!(member in resolved)) continue;
        const authored = authoredMembers[member];
        const lineHeight =
          member === 'lineHeight'
            ? translated.get(
                referenced(authored, allTokens)?.path.join('.') ?? '',
              )
            : undefined;
        const plain = lineHeight
          ? `${lineHeight.plain}px`
          : styleValue(deref(resolved[member], basePaths));
        // `variable` names a variable that exists — a reference to anything else is
        // materialized, like an alias whose target has no variable.
        const target = dtcg.tokens.isReference(authored)
          ? dotToSlash(dtcg.tokens.referenceToPath(authored))
          : undefined;
        const type =
          target !== undefined ? variableNames.get(target) : undefined;
        if (target !== undefined && type !== undefined) {
          if (bindable(property, type, plain)) bound.add(member);
          properties.push({ property, value: plain, variable: target });
        } else {
          properties.push({ property, value: plain });
        }
      }
      // A style has no modes: it depends on its own file and on every file an UNBOUND member
      // reaches. A bound member is resolved per mode by the design tool, like an alias, so it
      // adds nothing — which is what lets one style serve every composition.
      const files = new Set(own);
      for (const [member, authored] of Object.entries(authoredMembers)) {
        if (!bound.has(member)) chainFiles(authored, basePaths, files);
      }
      recordDeps(files);
      model.styles.push({
        kind: 'text',
        name: slash(token.path),
        properties,
        source: { $type: token.type, $value: token.value },
        ...deprecationOf(token),
      });
      return;
    }
    recordDeps(chainFiles(raw, basePaths, own));
    if (token.type === 'shadow') {
      const layers = Array.isArray(value) ? value : [value];
      const properties: FigmaStyleProperty[] = layers.flatMap((layer, index) =>
        layer && typeof layer === 'object'
          ? Object.entries(layer as Record<string, unknown>).map(
              ([member, held]) => ({
                property: layers.length > 1 ? `${index}/${member}` : member,
                value: styleValue(deref(held, basePaths)),
              }),
            )
          : [],
      );
      model.styles.push({
        kind: 'effect',
        name: slash(token.path),
        properties,
        source: { $type: token.type, $value: token.value },
        ...deprecationOf(token),
      });
    }
  };

  // Set collections: resolver sets in order; tokens by source file, minus modifier-claimed ones.
  const skipped = new Set<string>();
  for (const [setName, set] of Object.entries(input.resolver.sets)) {
    const files = new Set(
      (set.sources ?? []).map((source) =>
        String((source as { $ref?: string }).$ref ?? '').replace(/\.json$/, ''),
      ),
    );
    const variables: FigmaVariable[] = [];
    for (const token of input.base) {
      const path = token.path.join('.');
      if (claimed.has(path)) continue;
      if (!files.has(token.set ?? '')) continue;
      const built = await buildVariables(token, [
        { mode: 'default', bundle: basePaths },
      ]);
      if (built === undefined) {
        skipped.add(token.type);
        continue;
      }
      if (built !== 'style') variables.push(...built);
    }
    if (variables.length === 0) continue; // styles only, or every path owned by a modifier
    model.collections.push({ name: setName, modes: ['default'], variables });
  }

  // Modifier collections: contexts as modes, values per resolved bundle.
  for (const axis of axes) {
    const modes = axis.contexts.map((context) => ({
      mode: context,
      bundle: axis.bundles.get(context) ?? basePaths,
    }));
    const variables: FigmaVariable[] = [];
    for (const [path, modifier] of claimed) {
      if (modifier !== axis.modifier) continue;
      const token = allTokens.get(path);
      if (!token) continue;
      const built = await buildVariables(token, modes);
      if (built === undefined) {
        skipped.add(token.type);
        continue;
      }
      if (built !== 'style') variables.push(...built);
    }
    if (variables.length === 0) {
      notices.push(
        `modifier '${axis.modifier}' overrides nothing here — no collection emitted for it`,
      );
      continue;
    }
    model.collections.push({
      name: axis.modifier,
      modes: axis.contexts,
      variables,
    });
  }

  for (const type of skipped) {
    notices.push(
      `tokens of type '${type}' have no Figma mapping — provide one via options.types`,
    );
  }
  return { model, deps };
}
