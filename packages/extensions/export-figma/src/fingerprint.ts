import { stable } from './merge';
import type { FigmaModel } from './model';

/**
 * `sha256:<hex>` of what a design file would hold — the model's collections and styles, in stable
 * JSON. The `source` block (notices, generator, compositions) is deliberately outside it: two
 * models fingerprint equal exactly when applying either leaves a file in the same state. Web
 * Crypto, so it runs the same in Node and a browser.
 */
export async function fingerprintOf(model: FigmaModel): Promise<string> {
  const data = new TextEncoder().encode(
    stable({ collections: model.collections, styles: model.styles }),
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
