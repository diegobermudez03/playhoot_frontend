import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Navigate, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { capturedSignInCompletion } from '../../platform/signInCompletion';
import { AppShell, Button, Card, Owl, Stage } from '../../ui';
import { signInPath } from '../paths';
import { accountSignInErrorText } from './accountSignInErrors';
import styles from './SignIn.module.css';

// One completion per page load: StrictMode runs effects twice, and a code works once.
let completing = false;

// `/sign-in/complete`: where the provider sends the person back. Exchanges the one-time code (read
// and removed from the URL at startup) and continues where the sign-in was started from.
export function SignInCompleteRoute() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { accountSignIn } = useServices();
  const state = useStore(accountSignIn.store);
  const completion = capturedSignInCompletion();

  useEffect(() => {
    if (completing || !completion) return;
    completing = true;
    void accountSignIn.complete(completion).then((done) => {
      if (done) void navigate(done.next ?? '/', { replace: true });
    });
  }, [accountSignIn, completion, navigate]);

  // Reached without the provider sending anyone here.
  if (!completion) return <Navigate to="/" replace />;

  const failed = state.status === 'failed' && state.error;
  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Owl size={88} />
          <h1 className={styles.title}>
            <FormattedMessage
              id={failed ? 'signInComplete.failedTitle' : 'signInComplete.working'}
            />
          </h1>
        </div>
        {failed && (
          <Card>
            <div className={styles.form}>
              <p className={styles.notice} role="alert">
                {accountSignInErrorText(intl, failed)}
              </p>
              <Button block onClick={() => void navigate(signInPath(), { replace: true })}>
                <FormattedMessage id="signInComplete.back" />
              </Button>
            </div>
          </Card>
        )}
      </Stage>
    </AppShell>
  );
}
