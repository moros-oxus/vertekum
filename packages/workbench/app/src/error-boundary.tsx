import { Component, type ReactNode } from 'react';

/**
 * Contains a crashing extension to its own pane instead of taking down the shell (ADR-0022
 * resilience). Placed inside each extension's mount root by reactMount, so a failing
 * extension shows a fallback rather than a blank/broken app.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="vtk-error" role="alert">
          <strong>This view failed to load.</strong>
          <span>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
