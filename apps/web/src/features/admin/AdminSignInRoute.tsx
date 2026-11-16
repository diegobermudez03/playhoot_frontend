import { createAdminSignIn } from '@playhoot/feature-admin';
import { totpCodeAlphabet, totpCodeLength } from '@playhoot/protocol';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, CodeInput, PageHeading } from '../../ui';
import { adminPaths, adminSignInPath, safeNext } from '../paths';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { AdminFrame } from './AdminShell';

// `/admin/sign-in`: the account first (through the one public authentication screen), then the
// code that opens admin mode for fifteen minutes (D-015, D-023). When the token lapses inside a
// panel the person lands here with that panel's address as `next`, and goes straight back to it.
export function AdminSignInRoute() {
  const location = useLocation();
  const { adminSession } = useServices();
  const session = useStore(adminSession.store);
  const auth = useAuth();
  const next = safeNext(location.search) ?? adminPaths.home;

  if (session.status === 'active') return <Navigate to={next} replace />;
  return (
    <AdminFrame>
      {auth.status === 'unknown' ? null : auth.status === 'authenticated' ? (
        <CodePanel next={next} />
      ) : (
        <AccountFirst here={location.pathname + location.search} />
      )}
    </AdminFrame>
  );
}

// Admin mode needs an account, and the app has one screen that signs people in: this one sends
// them there with the reason it was needed, and `next` brings them back here.
function AccountFirst({ here }: { here: string }) {
  const intl = useIntl();
  const paths = useLocalePaths();
  const navigate = useNavigate();
  const to = paths.auth({ reason: 'admin', level: 'account', next: here });
  return (
    <>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.signIn.title' })}
        lead={intl.formatMessage({ id: 'admin.signIn.accountFirst' })}
      />
      <Card>
        <div className={styles.form}>
          <Button onClick={() => void navigate(to)}>
            <FormattedMessage id="admin.signIn.goToAccount" />
          </Button>
        </div>
      </Card>
    </>
  );
}

function CodePanel({ next }: { next: string }) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { adminSession, secondFactor } = useServices();
  const [signIn] = useState(() => createAdminSignIn({ secondFactor, session: adminSession }));
  const state = useStore(signIn.store);
  const [code, setCode] = useState('');
  const heading = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.querySelector('h1')?.focus();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== totpCodeLength) return;
    const opened = await signIn.submit(code);
    setCode('');
    if (opened) void navigate(next, { replace: true });
  };

  return (
    <>
      <div ref={heading}>
        <PageHeading
          title={intl.formatMessage({ id: 'admin.signIn.title' })}
          lead={intl.formatMessage({ id: 'admin.signIn.codeLead' })}
        />
      </div>
      <Card>
        <form className={styles.form} onSubmit={submit} noValidate>
          <CodeInput
            label={intl.formatMessage({ id: 'admin.signIn.codeLabel' })}
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
            {state.error ? adminErrorText(intl, state.error) : ''}
          </p>
          <Button
            type="submit"
            size="lg"
            block
            loading={state.submitting}
            disabled={code.length !== totpCodeLength}
          >
            <FormattedMessage id="admin.signIn.submit" />
          </Button>
        </form>
      </Card>
      <p className={styles.note}>
        <FormattedMessage
          id="admin.signIn.enrollFirst"
          values={{
            link: (text) => (
              <Link to={`${adminPaths.secondFactor}?${nextQuery(next)}`}>{text}</Link>
            ),
          }}
        />
      </p>
    </>
  );
}

// The second factor screen comes back here when it is done, with the same destination in hand.
function nextQuery(next: string): string {
  return new URLSearchParams({ next: adminSignInPath(next) }).toString();
}
