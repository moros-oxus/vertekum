import type { ExtensionContext } from '@vertekum/core';
import type { MountFn } from './shell/ui-contribution';

/** A view a `ui` surface default-exports: built from its extension's activate context. */
export type LazyView<C> = (
  activateCtx: C,
  context: ExtensionContext,
) => unknown;

/**
 * Mount a view imported on demand (ADR-0029). React — and `reactMount` itself — is imported only
 * once the route actually mounts, so an extension's `api` surface stays React-free and a headless
 * boot never evaluates a `ui` module or its CSS. The view's return type is `unknown` here for the
 * same reason: naming `ReactNode` would put React in this module's type graph.
 */
export function lazyMount<C>(
  load: () => Promise<{ default: LazyView<C> }>,
  activateCtx: C,
): MountFn {
  return (element, context) => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([load(), import('./react-mount')]).then(
      ([module, { reactMount }]) => {
        if (cancelled) return;
        // `MountFn` may return nothing; normalize to `undefined` so `dispose` stays callable-or-absent.
        dispose =
          reactMount((ctx) => module.default(activateCtx, ctx) as never)(
            element,
            context,
          ) ?? undefined;
      },
    );
    return () => {
      cancelled = true;
      dispose?.();
    };
  };
}
