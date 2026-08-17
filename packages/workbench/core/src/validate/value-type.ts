import { DTCG_TOKEN_SCHEMA } from './dtcg-schema';

/**
 * "Does this value conform to this DTCG `$type`?" — judged by the published format schema's OWN
 * per-type value definitions (`…/values/<type>.json`, embedded with their `$id`s in the bundled
 * format schema), so "incompatible" (§7.4.5) means exactly what the spec's schema rejects, never
 * an invented compatibility table.
 *
 * ajv is imported dynamically so it never enters the module graph of a consumer that does not
 * validate — core's main entry is bundled into the browser app. The instance and each compiled
 * validator are cached; the format schema is draft-07, so the plain ajv build is the right one.
 */

const VALUES_BASE =
  'https://www.designtokens.org/schemas/2025.10/format/values/';

type Compiled = (data: unknown) => boolean;

let instance: Promise<{
  getSchema(id: string): Compiled | undefined;
}> | null = null;

function ajvInstance() {
  if (!instance) {
    instance = import('ajv').then((mod) => {
      const ajv = new mod.default({ strict: false, logger: false });
      ajv.addSchema(DTCG_TOKEN_SCHEMA as object);
      return ajv as unknown as { getSchema(id: string): Compiled | undefined };
    });
  }
  return instance;
}

const compiledByType = new Map<string, Compiled | undefined>();

/**
 * `undefined` = the schema defines no value shape for this type (unknown/custom) — nothing to say.
 */
export async function valueMatchesType(
  type: string,
  value: unknown,
): Promise<boolean | undefined> {
  if (!compiledByType.has(type)) {
    const ajv = await ajvInstance();
    compiledByType.set(type, ajv.getSchema(`${VALUES_BASE}${type}.json`));
  }
  const validate = compiledByType.get(type);
  if (!validate) return undefined;
  return validate(value);
}
