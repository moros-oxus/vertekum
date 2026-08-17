import type { ReleaseProvider } from 'vertekum';

/** Service-registry key under which the active ReleaseProvider is published (ADR-0023). */
export const RELEASE_PROVIDER_SERVICE = 'releaseProvider';

/** The published contract: a ReleaseProvider any extension can `get` to read/cut releases. */
export type ReleaseProviderService = ReleaseProvider;

/** First release version when no prior release exists (used by the /release route). */
export const INITIAL_VERSION = '0.1.0';
