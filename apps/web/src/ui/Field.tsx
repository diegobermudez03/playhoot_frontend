import { useId, type ReactNode } from 'react';

import styles from './Field.module.css';

interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  className?: string | undefined;
  // Receives the ids the control must carry, so the label, hint and error are
  // wired to it whatever the control is.
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
}

// The shared frame of every form control: label, control, and one line of hint
// or error below. TextField, Select and CodeInput are built on it, so a screen
// never has to wire `aria-describedby` by hand.
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
