import { createGuestSignIn, type GuestSignIn } from '@playhoot/feature-sign-in';
import { guestDisplayNameMaxLength } from '@playhoot/protocol';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, Navigate, useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Card, Dialog, Mascot, SplitStage, Stage, TextField } from '../../ui';
import { useLayout } from '../layout';
import { authRequest, joinCodeOf, type AuthRequest } from '../paths';
import { accountSignInErrorText } from './accountSignInErrors';
import { GoogleButton } from './GoogleButton';
import { identityErrorText } from './identityErrors';
import styles from './SignIn.module.css';

// `/{language}/sign-in`: the one authentication screen (B, P14§1). Its address is its whole input:
// why it was opened, the weakest identity that would do (`level`), whether the person asked for
// the account options although a guest would do (`use=account`), and where to continue (`next`,
// which still carries everything already typed). Copying the address reproduces the screen.
export function AuthRoute() {
  const auth = useAuth();
  const location = useLocation();
  const paths = useLocalePaths();
  const request = authRequest(location.search);
  // Nothing is asked until it is known whether anything has to be.
  if (auth.status === 'unknown') return null;
  // Already someone the operation accepts, and not here to leave a guest behind on purpose.
  const enough =
    auth.status === 'authenticated' ||
    (auth.status === 'guest' && request.level === 'guest' && !request.account);
  if (enough) return <Navigate to={request.next ?? paths.home} replace />;
  return <AuthScreen request={request} />;
}

function AuthScreen({ request }: { request: AuthRequest }) {
  const auth = useAuth();
  const layout = useLayout();
  const showAccount = request.level === 'account' || request.account;
  // The name survives the move between the two halves of this screen: it is the same route, only
  // its address changes, so nothing typed is asked for twice (WCAG 2.2 3.3.7).
  const [name, setName] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus starts on the reason, so the first thing read is why this screen appeared.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const joinCode = joinCodeOf(request.next);
  const hero = (
    <div className={styles.hero}>
      <Mascot size={88} />
      <h1 className={styles.title} tabIndex={-1} ref={heading}>
        <FormattedMessage id={`auth.reason.${request.reason}`} />
      </h1>
      {joinCode ? (
        <p className={styles.lead}>
          <FormattedMessage id="identity.joining" values={{ code: joinCode }} />
        </p>
      ) : (
        <p className={styles.lead}>
          <FormattedMessage id={showAccount ? 'auth.lead.account' : 'auth.lead.guest'} />
        </p>
      )}
    </div>
  );
  const panel = showAccount ? (
    <AccountPanel request={request} guestName={auth.status === 'guest' ? auth.displayName : null} />
  ) : (
    <GuestPanel request={request} name={name} onName={setName} />
  );

  // Compact: the mascot above the panel. Wide: beside it, so the form stays whole above a keyboard.
  return layout === 'wide' ? (
    <SplitStage aside={hero}>{panel}</SplitStage>
  ) : (
    <Stage>
      {hero}
      {panel}
    </Stage>
  );
}

// A guest is all the operation needs: the name is the main action and the account option is one
// line below it (C-01 — a guest is asked for a display name and nothing else).
function GuestPanel({
  request,
  name,
  onName,
}: {
  request: AuthRequest;
  name: string;
  onName: (name: string) => void;
}) {
  const intl = useIntl();
  const paths = useLocalePaths();
  const signIn = useGuestSignIn();
  const state = useStore(signIn.store);

  // Once there is an identity, the route itself continues to `next`.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn.submit(name);
  };

  return (
    <>
      <Card>
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label={intl.formatMessage({ id: 'identity.nameLabel' })}
            placeholder={intl.formatMessage({ id: 'identity.namePlaceholder' })}
            value={name}
            onChange={(event) => onName(event.target.value)}
            maxLength={guestDisplayNameMaxLength}
            autoComplete="nickname"
            error={state.error ? identityErrorText(intl, state.error) : null}
            hint={intl.formatMessage({ id: 'identity.nameHint' })}
          />
          <Button type="submit" size="lg" block loading={state.submitting}>
            <FormattedMessage id="identity.submit" />
          </Button>
        </form>
      </Card>
      <p className={styles.alternative}>
        <FormattedMessage
          id="identity.useAccount"
          values={{
            link: (text) => (
              <Link
                to={paths.auth({
                  reason: request.reason,
                  level: request.level,
                  account: true,
                  next: request.next,
                })}
              >
                {text}
              </Link>
            ),
          }}
        />
      </p>
    </>
  );
}

// An account is required, or the person asked for one: Google is the featured way in, the one-time
// code by email is shown but arrives with H3 (P03§8), and the backend's fictitious local provider
// appears only where it is offered.
function AccountPanel({ request, guestName }: { request: AuthRequest; guestName: string | null }) {
  const intl = useIntl();
  const paths = useLocalePaths();
  const { accountSignIn } = useServices();
  const state = useStore(accountSignIn.store);
  const [starting, setStarting] = useState<string | null>(null);
  // Which provider the guest is about to leave their guest identity for, while they confirm it.
  const [confirming, setConfirming] = useState<string | null>(null);

  // Asked again after 1, 2, 4... seconds (at most 30) while the backend cannot be reached.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      void accountSignIn.loadProviders().then((loaded) => {
        if (loaded || cancelled) return;
        timer = setTimeout(() => load(attempt + 1), Math.min(1000 * 2 ** attempt, 30_000));
      });
    };
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountSignIn]);

  // `leaving` is not shown: coming back from the provider with Back may restore this page as it
  // was.
  const busy = state.status === 'starting';
  // Only the providers this backend offers can be used (the local one only in development).
  const offers = (provider: string) => state.providers?.includes(provider) ?? false;
  const start = (provider: string) => {
    setConfirming(null);
    setStarting(provider);
    void accountSignIn.start(provider, request.next);
  };
  // A guest is told what this costs them before they leave the app for the provider (P03§10).
  const choose = (provider: string) =>
    guestName === null ? start(provider) : setConfirming(provider);

  return (
    <>
      <Card>
        <div className={styles.form}>
          <GoogleButton
            disabled={!offers('google') || busy}
            busy={busy && starting === 'google'}
            onClick={() => choose('google')}
          >
            <FormattedMessage id="signIn.google" />
          </GoogleButton>
          {state.providers && !offers('google') && (
            <p className={styles.soon}>
              <FormattedMessage id="signIn.googleSoon" />
            </p>
          )}
          <div className={styles.pending}>
            <Button variant="secondary" block disabled>
              <FormattedMessage id="auth.emailCode" />
            </Button>
            <p className={styles.soon}>
              <FormattedMessage id="auth.emailCodeSoon" />
            </p>
          </div>
          {offers('local') && (
            <Button
              variant="secondary"
              block
              loading={busy && starting === 'local'}
              disabled={busy}
              onClick={() => choose('local')}
            >
              <FormattedMessage id="signIn.local" />
            </Button>
          )}
          {state.status === 'failed' && state.error && (
            <p className={styles.notice} role="alert">
              {accountSignInErrorText(intl, state.error)}
            </p>
          )}
        </div>
      </Card>
      {request.level === 'guest' && (
        <p className={styles.alternative}>
          <FormattedMessage
            id="auth.backToGuest"
            values={{
              link: (text) => (
                <Link
                  to={paths.auth({
                    reason: request.reason,
                    level: request.level,
                    next: request.next,
                  })}
                >
                  {text}
                </Link>
              ),
            }}
          />
        </p>
      )}
      <Dialog
        open={confirming !== null}
        title={intl.formatMessage({ id: 'auth.guestSwitch.title' })}
        closeLabel={intl.formatMessage({ id: 'auth.guestSwitch.close' })}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              <FormattedMessage id="auth.guestSwitch.cancel" />
            </Button>
            <Button onClick={() => confirming !== null && start(confirming)}>
              <FormattedMessage id="auth.guestSwitch.confirm" />
            </Button>
          </>
        }
      >
        <p className={styles.notice}>
          <FormattedMessage id="auth.guestSwitch.body" values={{ name: guestName ?? '' }} />
        </p>
      </Dialog>
    </>
  );
}

// One instance per visit to the page; nothing to release when leaving it.
function useGuestSignIn(): GuestSignIn {
  const services = useServices();
  const [signIn] = useState(() =>
    createGuestSignIn({
      app: services.app,
      identity: services.identity,
      newIdempotencyKey: () => crypto.randomUUID(),
      onTelemetry: services.telemetry.signIn,
    }),
  );
  return signIn;
}
