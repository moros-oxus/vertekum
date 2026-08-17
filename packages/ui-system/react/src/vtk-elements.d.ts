// Hand-authored while aceify is on hold (normally aceify-generated). JSX typing for @vtk-ui's
// semantic custom-tag elements (ADR-0021) — unregistered tags, no shadow DOM.
import type { VtkBaseElement } from './types';

export interface VtkConcertinaElement extends VtkBaseElement {}
export interface VtkConcertinaItemElement extends VtkBaseElement {}
export interface VtkConcertinaHeaderElement extends VtkBaseElement {}
export interface VtkConcertinaContentElement extends VtkBaseElement {}
export interface VtkExampleElement extends VtkBaseElement {}
export interface VtkExampleHeaderElement extends VtkBaseElement {}
export interface VtkExampleContentElement extends VtkBaseElement {}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'vtk-concertina': VtkConcertinaElement;
      'vtk-concertina-item': VtkConcertinaItemElement;
      'vtk-concertina-header': VtkConcertinaHeaderElement;
      'vtk-concertina-content': VtkConcertinaContentElement;
      'vtk-example': VtkExampleElement;
      'vtk-example-header': VtkExampleHeaderElement;
      'vtk-example-content': VtkExampleContentElement;
    }
  }
}
