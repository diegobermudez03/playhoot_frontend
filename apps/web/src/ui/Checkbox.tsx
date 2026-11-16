import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  // The whole statement being agreed to, which may carry links inside it.
  label: ReactNode;
  hint?: string;
  error?: string | null;
}

// A statement the person agrees to, ticked or not. The box is a real checkbox drawn in ink: the
// platform keeps its keyboard behaviour and its announcement, and the statement beside it is the
// label, so clicking anywhere on it ticks the box.
export function Checkbox({ label, hint, error, className, ...input }: CheckboxProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <input
          {...input}
          id={id}
          type="checkbox"
          className={styles.box}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      </div>
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
