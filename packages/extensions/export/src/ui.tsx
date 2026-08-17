import type { LazyView } from 'vertekum';
import type { ActivateContext } from 'vertekum/core';
import { ExportRoute } from './ExportRoute';
import type { exportManifest } from './index';

/** The Export view, loaded on demand by the route's `lazyMount` thunk (ADR-0029). */
const view: LazyView<ActivateContext<typeof exportManifest>> = (
  activateCtx,
  context,
) => <ExportRoute context={context} config={activateCtx.config} />;
export default view;
