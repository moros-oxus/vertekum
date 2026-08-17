import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// JSX typing for the app's semantic custom element tags (ADR-0021). These are
// unregistered custom tags used purely for structure/styling — no shadow DOM.
// Standard HTML attributes (id, data-*, etc.) come from DetailedHTMLProps.
type VtkElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'vtk-shell': VtkElementProps;
      'vtk-toolbar': VtkElementProps;
      'vtk-ribbon': VtkElementProps;
      'vtk-statusbar': VtkElementProps;
      'vtk-slot-host': VtkElementProps;
      'vtk-settings': VtkElementProps;
      'vtk-extensions': VtkElementProps;
    }
  }
}
