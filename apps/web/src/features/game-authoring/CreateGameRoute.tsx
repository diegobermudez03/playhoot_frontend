import { operations } from '@playhoot/protocol';
import { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { gameWorkspacePath } from '../paths';
import styles from './GameWorkspace.module.css';

// `/games/new`: creates a game (an account's operation) and moves to its workspace, replacing this
// URL so going back does not create another one.
export function CreateGameRoute() {
  return (
    <RequireOperation operation={operations.createGame}>
      <CreateGame />
    </RequireOperation>
  );
}

function CreateGame() {
  const services = useServices();
  const navigate = useNavigate();
  // One key per visit: retries, and React's double effect in development, create one game.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [failed, setFailed] = useState(false);

  const create = useCallback(async () => {
    const result = await services.gamesApi.createGame(idempotencyKey);
    if (result.ok) {
      navigate(gameWorkspacePath(result.value.gameUUID), { replace: true });
      return;
    }
    setFailed(true);
  }, [services, idempotencyKey, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state changes only after the request answers
    void create();
  }, [create]);

  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Owl size={112} animated={!failed} mood={failed ? 'surprised' : 'happy'} />
          <h1 className={styles.heroTitle}>
            <FormattedMessage id={failed ? 'createGame.error' : 'createGame.creating'} />
          </h1>
        </div>
        {failed && (
          <Button
            size="lg"
            block
            onClick={() => {
              setFailed(false);
              void create();
            }}
          >
            <FormattedMessage id="createGame.retry" />
          </Button>
        )}
      </Stage>
    </AppShell>
  );
}
