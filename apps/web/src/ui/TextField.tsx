import type { InputHTMLAttributes } from 'react';

import styles from './Control.module.css';
import { Field } from './Field';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(wiring) => <input {...wiring} className={styles.control} {...input} />}
    </Field>
  );
}
