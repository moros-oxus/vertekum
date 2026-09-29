import type { LazyView } from 'vertekum';
import type { ActivateContext, ExtensionContext } from 'vertekum/core';
import type { tokensManifest } from './index';
import { TokensRoute } from './TokensRoute';

/** The Tokens view. `activateCtx.config` is the extension's scoped, typed settings view. */
const view: LazyView<ActivateContext<typeof tokensManifest>> = (
  activateCtx,
  context: ExtensionContext,
) => <TokensRoute context={context} config={activateCtx.config} />;
export default view;
