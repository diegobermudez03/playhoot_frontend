import { createEnrollment } from '@playhoot/feature-admin';
import { totpCodeAlphabet, totpCodeLength } from '@playhoot/protocol';
import { useEffect, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useLocation, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, CodeInput, PageHeading, Status, TextField } from '../../ui';
import { adminPaths, adminSignInPath, safeNext } from '../paths';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { AdminFrame } from './AdminShell';
import { QrCode } from './QrCode';

// `/admin/second-factor`: enrolling the administrator's TOTP credential, or replacing it. The
// secret and its otpauth URI are shown once (D-015); the QR is drawn in this browser, so neither
// ever reaches anyone else. A pending enrollment lapses after ten minutes.
export function AdminSecondFactorRoute() {
  const intl = useIntl();
  const auth = useAuth();
  const location = useLocation();
  const paths = useLocalePaths();
  const navigate = useNavigate();
  const { secondFactor } = useServices();
  const [enrollment] = useState(() => createEnrollment({ secondFactor }));
  const state = useStore(enrollment.store);
  const next = safeNext(location.search) ?? adminSignInPath();
  const here = location.pathname + location.search;

  // Nothing of the secret outlives the screen.
  useEffect(() => () => enrollment.discard(), [enrollment]);

  if (auth.status === 'unknown') return null;
  if (auth.status !== 'authenticated') {
    return (
      <AdminFrame>
        <PageHeading
          title={intl.formatMessage({ id: 'admin.secondFactor.title' })}
          lead={intl.formatMessage({ id: 'admin.signIn.accountFirst' })}
        />
        <Card>
          <div className={styles.form}>
            <Button
              onClick={() =>
                void navigate(paths.auth({ reason: 'admin', level: 'account', next: here }))
              }
            >
              <FormattedMessage id="admin.signIn.goToAccount" />
            </Button>
          </div>
        </Card>
      </AdminFrame>
    );
  }

  return (
    <AdminFrame>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.secondFactor.title' })}
        lead={intl.formatMessage({ id: 'admin.secondFactor.lead' })}
      />
      {state.step === 'confirmed' ? (
        <Card>
          <div className={styles.form}>
            <Status tone="success">
              <FormattedMessage id="admin.secondFactor.confirmed" />
            </Status>
            <Button onClick={() => void navigate(next, { replace: true })}>
              <FormattedMessage id="admin.secondFactor.continue" />
            </Button>
          </div>
        </Card>
      ) : state.step === 'pending' && state.pending ? (
        <ConfirmStep
          secret={state.pending.secret}
          uri={state.pending.otpauthUri}
          busy={state.busy}
          errorText={state.error ? adminErrorText(intl, state.error) : ''}
          onConfirm={(code) => void enrollment.confirm(code)}
          onDiscard={enrollment.discard}
        />
      ) : (
        <StartStep
          busy={state.busy}
          needsCurrentCode={state.error?.kind === 'current-code-required'}
          errorText={state.error ? adminErrorText(intl, state.error) : ''}
          onStart={(currentCode) => void enrollment.start(currentCode)}
        />
      )}
      <p className={styles.note}>
        <FormattedMessage
          id="admin.secondFactor.backToSignIn"
          values={{ link: (text) => <Link to={adminPaths.signIn}>{text}</Link> }}
        />
      </p>
    </AdminFrame>
  );
}

// Starting an enrollment. A credential already in use is replaced only with a code from the
// authenticator that holds it, which the backend asks for the first time.
function StartStep({
  busy,
  needsCurrentCode,
  errorText,
  onStart,
}: {
  busy: boolean;
  needsCurrentCode: boolean;
  errorText: string;
  onStart: (currentCode?: string) => void;
}) {
  const intl = useIntl();
  const [current, setCurrent] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (needsCurrentCode && current.length !== totpCodeLength) return;
    onStart(needsCurrentCode ? current : undefined);
  };
  return (
    <Card>
      <form className={styles.form} onSubmit={submit} noValidate>
        <p className={styles.note}>
          <FormattedMessage
            id={
              needsCurrentCode ? 'admin.secondFactor.replaceLead' : 'admin.secondFactor.startLead'
            }
          />
        </p>
        {needsCurrentCode && (
          <CodeInput
            label={intl.formatMessage({ id: 'admin.secondFactor.currentCodeLabel' })}
            labelVisible
            value={current}
            onChange={setCurrent}
            length={totpCodeLength}
            alphabet={totpCodeAlphabet}
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
          />
        )}
        <p role="alert" className={styles.note}>
          {errorText}
        </p>
        <Button type="submit" loading={busy}>
          <FormattedMessage id="admin.secondFactor.start" />
        </Button>
      </form>
    </Card>
  );
}

// The secret, once: as a QR for an authenticator app and as text to type by hand, then the first
// code it produces.
function ConfirmStep({
  secret,
  uri,
  busy,
  errorText,
  onConfirm,
  onDiscard,
}: {
  secret: string;
  uri: string;
  busy: boolean;
  errorText: string;
  onConfirm: (code: string) => void;
  onDiscard: () => void;
}) {
  const intl = useIntl();
  const [code, setCode] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== totpCodeLength) return;
    onConfirm(code);
    setCode('');
  };
  return (
    <Card>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Status tone="warning">
          <FormattedMessage id="admin.secondFactor.onceWarning" />
        </Status>
        <QrCode value={uri} label={intl.formatMessage({ id: 'admin.secondFactor.qrLabel' })} />
        <TextField
          label={intl.formatMessage({ id: 'admin.secondFactor.secretLabel' })}
          hint={intl.formatMessage({ id: 'admin.secondFactor.secretHint' })}
          value={secret}
          readOnly
          onFocus={(event) => event.target.select()}
        />
        <CodeInput
          label={intl.formatMessage({ id: 'admin.secondFactor.firstCodeLabel' })}
          labelVisible
          value={code}
          onChange={setCode}
          length={totpCodeLength}
          alphabet={totpCodeAlphabet}
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
        />
        <p role="alert" className={styles.note}>
          {errorText}
        </p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onDiscard}>
            <FormattedMessage id="admin.cancel" />
          </Button>
          <Button type="submit" loading={busy} disabled={code.length !== totpCodeLength}>
            <FormattedMessage id="admin.secondFactor.confirm" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
