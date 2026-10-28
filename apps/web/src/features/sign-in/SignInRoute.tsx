import { FormattedMessage } from 'react-intl';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '../../app/ServicesContext';
import { DevIdentityPicker } from '../../dev/DevIdentityPicker';
import { AppShell, Button, Card, Owl, SplitStage, Stage } from '../../ui';
import { useLayout } from '../layout';
import { safeNext } from '../paths';
import styles from './SignIn.module.css';

// `/sign-in?next=…`: the definitive route to sign in or register (with Google only, both are the
// same action). Continues to `next` once the person has an account. Google sign-in arrives with the
// backend's provider; until then, development builds sign in with the backend's test accounts.
export function SignInRoute() {
  const auth = useAuth();
  const layout = useLayout();
  const location = useLocation();
  const next = safeNext(location.search);
  if (auth.status === 'authenticated') return <Navigate to={next ?? '/'} replace />;

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
      </div>
    </Card>
  );
  const dev = import.meta.env.DEV ? <DevIdentityPicker /> : null;

  return (
    <AppShell>
      {layout === 'wide' ? (
        <SplitStage aside={hero}>
          {options}
          {dev}
        </SplitStage>
      ) : (
        <Stage>
          {hero}
          {options}
          {dev}
        </Stage>
      )}
    </AppShell>
  );
}
