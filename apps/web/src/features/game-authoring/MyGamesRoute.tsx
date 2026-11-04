import { createMyGamesList, type MyGamesList } from '@playhoot/feature-game-authoring';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { gameWorkspacePath, newGamePath } from '../paths';
import styles from './GameWorkspace.module.css';

// `/games`: the account's own games, newest first, each leading to its workspace.
export function MyGamesRoute() {
  return (
    <RequireOperation operation={operations.editGame}>
      <MyGames />
    </RequireOperation>
  );
}

function MyGames() {
  const services = useServices();
  const [list, setList] = useState<MyGamesList | null>(null);
  useEffect(() => {
    const next = createMyGamesList({ games: services.gamesApi });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setList(next);
    void next.load();
    return () => next.dispose();
  }, [services]);
  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            <FormattedMessage id="myGames.title" />
          </h1>
        </div>
        <Card>{list && <GamesList list={list} />}</Card>
      </Stage>
    </AppShell>
  );
}

function GamesList({ list }: { list: MyGamesList }) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { load } = useStore(list.store);
  const create = (
    <Button block onClick={() => navigate(newGamePath)}>
      <FormattedMessage id="createGame.button" />
    </Button>
  );
  if (load.status === 'loading') {
    return (
      <p className={styles.muted}>
        <FormattedMessage id="myGames.loading" />
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <div className={styles.form}>
        <p className={styles.warningText} role="alert">
          <FormattedMessage id="myGames.error" />
        </p>
        <Button variant="secondary" onClick={() => void list.load()}>
          <FormattedMessage id="myGames.retry" />
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.form}>
      {load.items.length === 0 ? (
        <p className={styles.muted}>
          <FormattedMessage id="myGames.empty" />
        </p>
      ) : (
        <ul className={styles.list} data-testid="my-games">
          {load.items.map((game) => (
            <li key={game.gameUUID} className={styles.listItem}>
              <div className={styles.listRow}>
                <Link to={gameWorkspacePath(game.gameUUID)}>
                  <strong>{game.name || intl.formatMessage({ id: 'myGames.unnamed' })}</strong>
                </Link>
                <span className={`${styles.badge} ${game.published ? styles.badgeOk : ''}`}>
                  {game.published ? (
                    <FormattedMessage
                      id="myGames.published"
                      values={{ visibility: game.visibility }}
                    />
                  ) : (
                    <FormattedMessage id="myGames.unpublished" />
                  )}
                </span>
                {game.publishing && (
                  <span className={styles.muted}>
                    <FormattedMessage id="myGames.publishing" />
                  </span>
                )}
                {game.editing && game.published && (
                  <span className={styles.muted}>
                    <FormattedMessage id="myGames.editing" />
                  </span>
                )}
                <span className={styles.muted}>
                  {intl.formatDate(game.updatedAt, { dateStyle: 'medium' })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {create}
    </div>
  );
}
