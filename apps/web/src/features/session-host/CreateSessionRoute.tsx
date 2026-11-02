import { activeSessionLimitCode, operations } from '@playhoot/protocol';
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

type Creation =
  | { status: 'creating' }
  | { status: 'failed'; reason: 'game-unavailable' | 'active-limit' | 'other' };

function CreateSession() {
  const services = useServices();
  const navigate = useNavigate();
  // One key per visit: retries, and React's double effect in development, create one Session.
  // Only after the active Session limit does a retry take a new key (the old one keeps refusing).
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [creation, setCreation] = useState<Creation>({ status: 'creating' });

  const create = useCallback(async () => {
    const result = await services.sessionsApi.createSession(hostedGameUUID, idempotencyKey);
    if (result.ok) {
      navigate(sessionHostPath(result.value.sessionUUID, result.value.joinCode), {
        replace: true,
      });
      return;
    }
    const failure = result.error;
    const reason =
      failure.kind === 'http' && failure.status === 404
        ? 'game-unavailable'
        : failure.kind === 'http' && failure.code === activeSessionLimitCode
          ? 'active-limit'
          : 'other';
    setCreation({ status: 'failed', reason });
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
            ) : creation.reason === 'active-limit' ? (
              <FormattedMessage id="createSession.error.activeLimit" />
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
              const activeLimit = creation.reason === 'active-limit';
              setCreation({ status: 'creating' });
              // A new key changes `create`, and the effect runs it.
              if (activeLimit) setIdempotencyKey(crypto.randomUUID());
              else void create();
            }}
          >
            <FormattedMessage id="createSession.retry" />
          </Button>
        )}
      </Stage>
    </AppShell>
  );
}
