import type { AdminFailure } from '@playhoot/feature-admin';
import { totpCodeAlphabet, totpCodeLength } from '@playhoot/protocol';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { Button, CodeInput, TextField } from '../../ui';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';

interface StepUpFormProps {
  // What the main button says, named for the action it performs (WCAG 2.2 3.3.2).
  submitLabel: string;
  // Anything the action needs beside the reason and the code (the caps being set).
  children?: ReactNode;
  busy: boolean;
  error: AdminFailure | null;
  onCancel: () => void;
  onSubmit: (code: string, reason: string) => void;
}

// The confirm step of one sensitive action (D-011): a fresh code from the authenticator and the
// reason the change is being made, which the backend records with the change. The code is spent
// by this action alone; a refused proof asks for another code without losing what was typed.
export function StepUpForm({
  submitLabel,
  children,
  busy,
  error,
  onCancel,
  onSubmit,
}: StepUpFormProps) {
  const intl = useIntl();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== totpCodeLength || reason.trim() === '') return;
    onSubmit(code, reason.trim());
    // A refused proof needs another code; what was typed about the change stays.
    setCode('');
  };
  return (
    <form className={styles.confirm} onSubmit={submit} noValidate>
      {children}
      <TextField
        label={intl.formatMessage({ id: 'admin.stepUp.reasonLabel' })}
        hint={intl.formatMessage({ id: 'admin.stepUp.reasonHint' })}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={reasonMaxLength}
        required
      />
      <CodeInput
        label={intl.formatMessage({ id: 'admin.stepUp.codeLabel' })}
        labelVisible
        value={code}
        onChange={setCode}
        length={totpCodeLength}
        alphabet={totpCodeAlphabet}
        autoComplete="one-time-code"
        inputMode="numeric"
      />
      <p role="alert" className={styles.note}>
        {error ? adminErrorText(intl, error) : ''}
      </p>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          <FormattedMessage id="admin.cancel" />
        </Button>
        <Button
          type="submit"
          variant="danger"
          loading={busy}
          disabled={code.length !== totpCodeLength || reason.trim() === ''}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Long enough for a sentence about why, short enough to stay one line in the change history.
export const reasonMaxLength = 200;
