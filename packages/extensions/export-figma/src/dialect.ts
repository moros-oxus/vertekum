import type { FigmaModel } from './model';

/**
 * The dialect seam: a writer is a pure function from the model to one importer's file shape,
 * passed in a target's `options.dialects` (the terrazzo pattern — config is the vessel, no
 * registry). Dialect packages peer on this package for the model types and export a factory
 * (`somethingDialect(options)`), so third parties contribute importer support as plain npm
 * packages the same way terrazzo plugins do.
 */

export interface OutputFile {
  path: string;
  content: string;
}

export interface FigmaDialect {
  /** Namespaces the writer's files under `<out>/<id>/`. */
  id: string;
  write(model: FigmaModel): OutputFile[];
}
