import { FormattedMessage, useIntl } from 'react-intl';
import { Navigate, useLocation } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, SplitStage, Stage } from '../../ui';
import { useLayout } from '../layout';
import { safeNext } from '../paths';
import { accountSignInErrorText } from './accountSignInErrors';
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
  if (auth.status === 'authenticated') return <Navigate to={next ?? '/'} replace />;
  // `leaving` is not shown: coming back from the provider with Back may restore this page as it
  // was.
  const busy = state.status === 'starting';

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
        <Button size="lg" block disabled>
          <FormattedMessage id="signIn.google" />
        </Button>
        <p className={styles.soon}>
          <FormattedMessage id="signIn.googleSoon" />
        </p>
        {import.meta.env.DEV && (
          <Button
            variant="secondary"
            block
            loading={busy}
            onClick={() => void accountSignIn.start('local', next)}
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
