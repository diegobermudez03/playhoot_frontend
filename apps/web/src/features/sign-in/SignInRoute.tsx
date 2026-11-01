import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Navigate, useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, SplitStage, Stage } from '../../ui';
import { useLayout } from '../layout';
import { safeNext } from '../paths';
import { accountSignInErrorText } from './accountSignInErrors';
import { GoogleButton } from './GoogleButton';
import styles from './SignIn.module.css';

// `/sign-in?next=…`: the definitive route to sign in or register (with Google only, both are the
// same action). Continues to `next` once the person has an account. Google sign-in arrives with the
// backend's provider; until then, development builds sign in through the backend's fictitious local
// provider.
export function SignInRoute() {
  const intl = useIntl();
  const auth = useAuth();
  const layout = useLayout();
  const location = useLocation();
  const { accountSignIn } = useServices();
  const state = useStore(accountSignIn.store);
  const next = safeNext(location.search);
  const [starting, setStarting] = useState<string | null>(null);
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
  if (auth.status === 'authenticated') return <Navigate to={next ?? '/'} replace />;
  // `leaving` is not shown: coming back from the provider with Back may restore this page as it
  // was.
  const busy = state.status === 'starting';
  // Only the providers this backend offers can be used (the local one only in development).
  const offers = (provider: string) => state.providers?.includes(provider) ?? false;
  const start = (provider: string) => {
    setStarting(provider);
    void accountSignIn.start(provider, next);
  };

  const hero = (
    <div className={styles.hero}>
      <Owl size={88} />
      <h1 className={styles.title}>
        <FormattedMessage id="signIn.title" />
      </h1>
      <p className={styles.lead}>
        <FormattedMessage id="signIn.lead" />
      </p>
    </div>
  );
  const options = (
    <Card>
      <div className={styles.form}>
        {auth.status === 'guest' && (
          <p className={styles.notice}>
            <FormattedMessage id="signIn.guestSwitch" values={{ name: auth.displayName ?? '' }} />
          </p>
        )}
        <GoogleButton
          disabled={!offers('google') || busy}
          busy={busy && starting === 'google'}
          onClick={() => start('google')}
        >
          <FormattedMessage id="signIn.google" />
        </GoogleButton>
        {state.providers && !offers('google') && (
          <p className={styles.soon}>
            <FormattedMessage id="signIn.googleSoon" />
          </p>
        )}
        {offers('local') && (
          <Button
            variant="secondary"
            block
            loading={busy && starting === 'local'}
            disabled={busy}
            onClick={() => start('local')}
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
  );

  return (
    <AppShell>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>{options}</SplitStage>
      ) : (
        <Stage>
          {hero}
          {options}
        </Stage>
      )}
    </AppShell>
  );
}
