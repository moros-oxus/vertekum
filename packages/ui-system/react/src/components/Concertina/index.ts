/** Namespaced primitive for dot notation (tree-shakable). */

export { type ConcertinaProps, default as Concertina } from './Concertina';
export {
  type ConcertinaContentProps,
  default as ConcertinaContent,
} from './ConcertinaContent';
export {
  type ConcertinaHeaderProps,
  default as ConcertinaHeader,
} from './ConcertinaHeader';
export {
  type ConcertinaItemProps,
  default as ConcertinaItem,
} from './ConcertinaItem';
export {
  type ConcertinaTriggerProps,
  default as ConcertinaTrigger,
} from './ConcertinaTrigger';
export * as ConcertinaPrimitive from './index.primitives';
export {
  type ConcertinaItemContext,
  useConcertinaItem,
} from './useConcertinaItem';
