import type { HostLive, HostStartedSession } from '@playhoot/feature-session-host';
import { createSessionPlay, type SessionPlay } from '@playhoot/feature-session-play';
import { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { createIframeGameContainer } from '../../platform/iframeGameContainer';
import { Button } from '../../ui';
import styles from './HostScreen.module.css';

// The watched participant's game, run by the same GameHost as a player's but read only: whatever
// the game sends is dropped by the host's live link. A new participant is a new game run.
export function HostGameView({
  session,
  watching,
  live,
}: {
  session: HostStartedSession;
  watching: string;
  live: HostLive;
}) {
  const play = useWatchedPlay(session, watching, live);
  const intl = useIntl();
  const frame = useRef<HTMLDivElement>(null);
  const frameTitle = intl.formatMessage({ id: 'play.gameFrame' });

  useEffect(() => {
    const parent = frame.current;
    if (!parent || !play) return;
    return play.attach(createIframeGameContainer(parent, frameTitle));
  }, [play, frameTitle]);

  return (
    <div className={styles.gameArea}>
      <div ref={frame} className={styles.gameFrame} />
      {play && <GameStatus play={play} />}
    </div>
  );
}

function GameStatus({ play }: { play: SessionPlay }) {
  const { game } = useStore(play.store);
  if (game.phase === 'loading' || game.phase === 'starting') {
    return (
      <p className={styles.gameStatus}>
        <FormattedMessage id="host.game.loading" />
      </p>
    );
  }
  if (game.phase !== 'failed') return null;
  return (
    <div className={styles.gameStatus}>
      <div className={styles.controls}>
        <FormattedMessage id="host.game.failed" />
        <Button variant="secondary" onClick={play.reload}>
          <FormattedMessage id="host.game.retry" />
        </Button>
      </div>
    </div>
  );
}

function useWatchedPlay(
  session: HostStartedSession,
  watching: string,
  live: HostLive,
): SessionPlay | null {
  const services = useServices();
  const intl = useIntl();
  const [play, setPlay] = useState<SessionPlay | null>(null);
  const key = `${watching}|${session.frontend.sha256}`;

  useEffect(() => {
    const next = createSessionPlay(
      {
        participantId: watching,
        participants: session.participants.map((p) => p.participantId),
        frontend: session.frontend,
      },
      intl.locale,
      {
        live,
        loader: services.gameArtifacts,
        assets: services.gameAssets,
        // No play telemetry: a watching host is not a player and would skew players' trends.
      },
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setPlay(next);
    return () => next.dispose();
    // One game run per watched participant and game version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, services]);

  return play;
}
