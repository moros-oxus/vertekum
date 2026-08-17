import type { ExtensionContext, LazyView } from 'vertekum';
import { CompositionRoute } from './CompositionRoute';

/** The Composition view, loaded on demand by the route's `lazyMount` thunk (ADR-0029). */
const view: LazyView<ExtensionContext> = (activateCtx) => (
  <CompositionRoute document={activateCtx.document} />
);
export default view;
