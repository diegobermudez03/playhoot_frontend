import type { TextareaHTMLAttributes } from 'react';

import styles from './Control.module.css';
import { Field } from './Field';

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
}

// A multi-line control in the same skin as TextField, for content too long for one line (an
// acceptance text's body).
export function TextareaField({
  label,
  hint,
  error,
  className,
  rows = 10,
  ...textarea
}: TextareaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(wiring) => (
        <textarea
          {...wiring}
          className={`${styles.control} ${styles.textarea}`}
          rows={rows}
          {...textarea}
        />
      )}
    </Field>
  );
}
