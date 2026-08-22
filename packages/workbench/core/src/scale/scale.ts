/**
 * Scale expressions — ONE authority for generating a scale's names and values, shared by
 * every consumer (the schema grammar enumerates the names; token-side materialization will
 * generate the values), so a name can never drift from the value it mirrors.
 */

/**
 * Affixes wrap the NAME only (`(2-4)xs` → names `2xs…4xs`); `values` stay numeric. The numeric
 * series is the backbone every rule binds on — integrality, collisions, pad — and what a
 * token-side materializer consumes as the value while the affixed string is the name.
 */
interface ScaleAffixes {
  prefix?: string;
  suffix?: string;
}

export type ScaleExpression =
  | ({
      kind: 'stepped';
      min: number;
      max: number;
      step: number;
      pad?: number;
    } & ScaleAffixes)
  | ({
      kind: 'multiplied';
      min: number;
      max: number;
      factor: number;
      quantum?: number;
      pad?: number;
    } & ScaleAffixes);

export interface ScaleResult {
  /** Formatted names, in generation order (zero-padded when `pad` is set). */
  names: string[];
  /** The (quantized) numeric values, aligned with `names`. */
  values: number[];
  /** Raw steps whose quantized value landed on an earlier entry — deduped away, reported. */
  collisions: number[];
}

/** Floating-point guard for the raw-series bound: `min · f^n` may land at `max ± 1e-16`. */
const EPSILON = 1e-9;
const MAX_ENTRIES = 10_000;

/**
 * Evaluate a scale expression.
 *
 * Locked semantics: bounds are inclusive and apply to the RAW series; compounding is
 * raw-basis (the ratio never applies to a rounded value) with each step quantized
 * independently; quantization is to the nearest multiple of `quantum`, halves away from
 * zero — so a quantized value may stand just past `max`. Collisions dedupe forward
 * (first occurrence wins) and are reported, never swallowed: deciding whether they are an
 * error belongs to the caller.
 */
export function evaluateScale(expression: ScaleExpression): ScaleResult {
  if (expression.kind === 'stepped') {
    if (expression.step <= 0) {
      throw new Error('a stepped scale needs a step greater than zero');
    }
  } else if (expression.factor <= 1) {
    throw new Error('a multiplied scale needs a factor greater than one');
  }
  if (expression.max < expression.min) {
    throw new Error('a scale needs max >= min');
  }

  const raws: number[] = [];
  for (
    let raw = expression.min;
    raw <= expression.max + EPSILON;
    raw =
      expression.kind === 'stepped'
        ? raw + expression.step
        : raw * expression.factor
  ) {
    raws.push(raw);
    if (raws.length > MAX_ENTRIES) {
      throw new Error(`a scale stops at ${MAX_ENTRIES} entries`);
    }
  }

  const quantum =
    expression.kind === 'multiplied' ? expression.quantum : undefined;
  const names: string[] = [];
  const values: number[] = [];
  const collisions: number[] = [];
  const seen = new Set<number>();

  for (const raw of raws) {
    const value = quantum
      ? Math.round(raw / quantum) * quantum
      : Math.round(raw * 1e9) / 1e9;
    if (!Number.isInteger(value)) {
      throw new Error(
        `step ${raw} is not a whole number — names are names; quantize (~) or adjust the scale`,
      );
    }
    if (seen.has(value)) {
      collisions.push(raw);
      continue;
    }
    seen.add(value);
    values.push(value);
    const digits = expression.pad
      ? String(value).padStart(expression.pad, '0')
      : String(value);
    names.push(`${expression.prefix ?? ''}${digits}${expression.suffix ?? ''}`);
  }

  return { names, values, collisions };
}
