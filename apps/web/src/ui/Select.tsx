import type { SelectHTMLAttributes } from 'react';

import styles from './Control.module.css';
import { Field } from './Field';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
}

// A native <select> in the system's skin: the platform keeps the list and its
// keyboard behaviour, only the closed control is drawn in ink.
export function Select({ label, hint, error, className, children, ...select }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(wiring) => (
        <span className={styles.selectWrap}>
          <select {...wiring} className={`${styles.control} ${styles.select}`} {...select}>
            {children}
          </select>
          <svg
            className={styles.arrow}
            width="16"
            height="10"
            viewBox="0 0 16 10"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2 2 L8 8 L14 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </Field>
  );
}
