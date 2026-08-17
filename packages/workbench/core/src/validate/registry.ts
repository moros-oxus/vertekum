import type { Validator, ValidatorService } from './validator';

/** An id-keyed validator registry, published under VALIDATOR_SERVICE. Last registration wins. */
export function createValidatorRegistry(): ValidatorService {
  const byId = new Map<string, Validator>();
  return {
    register(validator) {
      byId.set(validator.id, validator);
    },
    list() {
      return [...byId.values()];
    },
  };
}
