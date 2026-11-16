import type { EmailSignInState } from '@playhoot/feature-sign-in';
import { emailCodeAlphabet, emailCodeLength } from '@playhoot/protocol';
import { type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { Button, CodeInput, TextField } from '../../ui';
import { emailSignInErrorText } from './emailSignInErrors';
import styles from './SignIn.module.css';

interface EmailCodeFormProps {
  state: EmailSignInState;
  address: string;
  onAddress: (address: string) => void;
  code: string;
  onCode: (code: string) => void;
  // Asks for a code for the address typed. A guest confirms what it costs them first.
  onSend: () => void;
  // Asks for another code for the same address, which supersedes the one already sent.
  onResend: () => void;
  onSubmitCode: () => void;
  onEditAddress: () => void;
  disabled: boolean;
}

// The way in that needs no provider (P03§8, D-033): type an address, receive a 6-digit code,
// type it to enter or to finish registering. Which of the two steps is open is screen state —
// the attempt itself lives on the backend, like the trip to a provider.
export function EmailCodeForm({
  state,
  address,
  onAddress,
  code,
  onCode,
  onSend,
  onResend,
  onSubmitCode,
  onEditAddress,
  disabled,
}: EmailCodeFormProps) {
  const intl = useIntl();
  const error = state.error ? emailSignInErrorText(intl, state.error) : null;

  if (state.step === 'address') {
    const send = (event: FormEvent) => {
      event.preventDefault();
      onSend();
    };
    return (
      <form className={styles.emailForm} onSubmit={send} noValidate>
        <TextField
          label={intl.formatMessage({ id: 'emailCode.addressLabel' })}
          placeholder={intl.formatMessage({ id: 'emailCode.addressPlaceholder' })}
          value={address}
          onChange={(event) => onAddress(event.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          error={error}
          hint={intl.formatMessage({ id: 'emailCode.addressHint' })}
        />
        <Button
          type="submit"
          variant="secondary"
          block
          loading={state.status === 'sending'}
          disabled={disabled}
        >
          <FormattedMessage id="emailCode.send" />
        </Button>
      </form>
    );
  }

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    onSubmitCode();
  };
  return (
    <form className={styles.emailForm} onSubmit={confirm} noValidate>
      <p className={styles.sent}>
        <FormattedMessage
          id={state.resent ? 'emailCode.sentAgain' : 'emailCode.sent'}
          values={{ address: state.address }}
        />
      </p>
      <CodeInput
        value={code}
        onChange={onCode}
        length={emailCodeLength}
        alphabet={emailCodeAlphabet}
        label={intl.formatMessage({ id: 'emailCode.codeLabel' })}
        labelVisible
        autoFocus
        autoComplete="one-time-code"
        inputMode="numeric"
        error={error}
        hint={intl.formatMessage({ id: 'emailCode.codeHint' })}
      />
      <Button
        type="submit"
        size="lg"
        block
        loading={state.status === 'completing'}
        disabled={code.length !== emailCodeLength}
      >
        <FormattedMessage id="emailCode.confirm" />
      </Button>
      <div className={styles.emailActions}>
        <Button
          variant="ghost"
          onClick={onResend}
          loading={state.status === 'sending'}
          disabled={state.status !== 'idle'}
        >
          <FormattedMessage id="emailCode.resend" />
        </Button>
        <Button variant="ghost" onClick={onEditAddress} disabled={state.status !== 'idle'}>
          <FormattedMessage id="emailCode.changeAddress" />
        </Button>
      </div>
    </form>
  );
}
