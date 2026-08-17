import { type ReactNode, useEffect, useId, useRef } from 'react';
import './Dialog.css';

/**
 * Presentational modal built on the native `<dialog>` element: `showModal()` gives a focus trap,
 * `Esc`-to-dismiss, `::backdrop`, and focus restoration to the invoker for free. The element is
 * always rendered (visibility is owned by `showModal`/`close`); an unmount-time `close()` keeps
 * native focus restoration working even when the parent unmounts the dialog on close.
 *
 * Document-ignorant — a candidate to move into `@vertekum-ui/react` unchanged.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Drive the native element from `open`; close on unmount so focus returns to the invoker.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
    return () => {
      if (el.open) el.close();
    };
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> handles keyboard dismissal (Esc); click only adds backdrop-close.
    <dialog
      ref={ref}
      data-vtk-dialog=""
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Backdrop click: the event target is the <dialog> itself (content sits in a child).
        if (e.target === ref.current) onClose();
      }}
    >
      <div data-vtk-dialog-body="">
        <h2 id={titleId} data-vtk-dialog-title="">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
