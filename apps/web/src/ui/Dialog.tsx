import { useEffect, useId, useRef, type ReactNode } from 'react';

import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  // Called when the person closes the dialog, by the close button, Escape or
  // the backdrop. The parent owns `open`.
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
  // The buttons of the dialog, in reading order; the last one is the main one.
  actions?: ReactNode;
}

/*
 * A modal built on the native <dialog> element: the browser traps focus inside
 * it, sends focus back to what opened it when it closes, and closes on Escape
 * (WCAG 2.2 2.1.2, 2.4.3). Nothing here re-implements that.
 *
 * It opens on its first focusable element, the close button, unless an element
 * inside is marked `data-autofocus`: React never writes `autofocus` to the page,
 * so the browser cannot see a component's `autoFocus` (found by the T-307 audit).
 */
export function Dialog({ open, title, onClose, closeLabel, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // The heading's id has to be unique in the document and stable across both renders. It used to
  // be built from the title itself, which made every untitled dialog `-title` and every pair of
  // dialogs sharing a title point at each other's heading (found by the T-207 audit).
  const titleId = `${useId()}-title`;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // The backdrop is the dialog element itself outside its box.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M3 3 L13 13 M13 3 L3 13"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </dialog>
  );
}
