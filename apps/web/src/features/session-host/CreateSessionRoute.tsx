import { operations } from '@playhoot/protocol';
import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { sessionHostPath } from '../paths';
import { hostedGameUUID } from './hostedGame';
import styles from './HostScreen.module.css';

// `/sessions/new`: creates a Session (an account's operation) and moves to its host screen,
// replacing this URL so going back does not create another one.
export function CreateSessionRoute() {
  return (
    <RequireOperation operation={operations.createSession}>
      <CreateSession />
    </RequireOperation>
  );
}

type Creation = { status: 'creating' } | { status: 'failed'; reason: 'game-unavailable' | 'other' };

function CreateSession() {
  const services = useServices();
  const navigate = useNavigate();
  // One key per visit: retries, and React's double effect in development, create one Session.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [creation, setCreation] = useState<Creation>({ status: 'creating' });

  const create = useCallback(async () => {
    const result = await services.sessionsApi.createSession(hostedGameUUID, idempotencyKey);
    if (result.ok) {
      navigate(sessionHostPath(result.value.sessionUUID, result.value.joinCode), {
        replace: true,
      });
      return;
    }
    const gameUnavailable = result.error.kind === 'http' && result.error.status === 404;
    setCreation({ status: 'failed', reason: gameUnavailable ? 'game-unavailable' : 'other' });
  }, [services, idempotencyKey, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state changes only after the request answers
    void create();
  }, [create]);

  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Owl size={112} animated={creation.status === 'creating'} />
          <h1 className={styles.title}>
            {creation.status === 'creating' ? (
              <FormattedMessage id="createSession.creating" />
            ) : creation.reason === 'game-unavailable' ? (
              <FormattedMessage id="createSession.error.unavailable" />
            ) : (
              <FormattedMessage id="createSession.error.failed" />
            )}
          </h1>
        </div>
        {creation.status === 'failed' && (
          <Button
            size="lg"
            block
            onClick={() => {
              setCreation({ status: 'creating' });
              void create();
            }}
          >
            <FormattedMessage id="createSession.retry" />
          </Button>
        )}
      </Stage>
    </AppShell>
  );
}
