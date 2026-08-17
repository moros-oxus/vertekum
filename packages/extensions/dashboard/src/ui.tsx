import type { ExtensionContext, LazyView } from 'vertekum';
import { Dashboard } from './Dashboard';

/** The Dashboard view, loaded on demand by the route's `lazyMount` thunk (ADR-0029). */
const view: LazyView<undefined> = (_activateCtx, context: ExtensionContext) => (
  <Dashboard context={context} />
);
export default view;
