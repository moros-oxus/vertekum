import type { ExtensionContext, LazyView } from 'vertekum';
import { ReleaseRoute } from './ReleaseRoute';

/** The Release view, loaded on demand by the route's `lazyMount` thunk (ADR-0029). */
const view: LazyView<ExtensionContext> = (_activateCtx, context) => (
  <ReleaseRoute context={context} />
);
export default view;
