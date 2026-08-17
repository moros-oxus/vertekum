import type React from 'react';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/** Base for all Vertekum custom-tag elements (JSX intrinsic typing); includes ref/key. */
export type VtkBaseElement = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
>;

/** Base Vertekum component props: the element's own props (+ ref), children, and custom props. */
export type VtkComponentProps<
  T extends React.ElementType,
  CustomProps extends Record<string, unknown> = Record<string, unknown>,
  RefElement extends React.ElementType = T,
> = React.ComponentPropsWithRef<T> & {
  children?: React.ReactNode;
  ref?: React.Ref<React.ComponentRef<RefElement>>;
} & CustomProps;
