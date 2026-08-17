import type { ExtensionContext } from '@vertekum/core';
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './error-boundary';
import type { MountFn } from './shell/ui-contribution';

/**
 * Bridge a React view to the framework-agnostic mount(element, context) contract
 * (ADR-0017). First-party routes/contributions render React into their own root, so they
 * stay decoupled from the shell's React tree (and its router) — navigation is provided by
 * the shell, not imported by route plugins (ADR-0022).
 *
 * NOTE: this is an extension-authoring binding (like `useTokens`), not app-specific. Its
 * destiny is a shared published package (e.g. `@vertekum-ui/react`) so *external* React
 * extensions can use it too; it lives in-app only while extensions are first-party.
 */
export function reactMount(
  render: (context: ExtensionContext) => ReactNode,
): MountFn {
  return (element, context) => {
    // Own container child so React fully manages its own root/DOM: this survives
    // StrictMode's mount→unmount→mount and never double-createRoots the same node.
    const container = document.createElement('div');
    container.style.display = 'contents';
    element.appendChild(container);
    const root = createRoot(container);
    // Wrap in an error boundary so a crashing extension is contained (ADR-0022).
    root.render(createElement(ErrorBoundary, null, render(context)));

    return () => {
      // Defer: unmounting a root synchronously during the parent's render/commit is
      // unsafe (React warns of a race). A microtask lets the current render finish.
      queueMicrotask(() => {
        root.unmount();
        container.remove();
      });
    };
  };
}
