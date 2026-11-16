import { useEffect, useRef, type ReactNode } from 'react';

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
 */
export function Dialog({ open, title, onClose, closeLabel, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${title}-title`}
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
        <h2 id={`${title}-title`} className={styles.title}>
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
