/**
 * `vertekum/core` — the React-free half of the umbrella. Extension `api.ts` surfaces import from
 * here so a headless boot never pulls React or CSS into the module graph; `ui.tsx` surfaces import
 * `vertekum` for `reactMount` and the document hooks (ADR-0029).
 */
export * from '@vertekum/core';
