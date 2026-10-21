import type { GameHostError, GameHostStatus } from '@playhoot/game-host';
import { useEffect, type Ref } from 'react';
import { FormattedMessage } from 'react-intl';

import { useSound } from '../../sound';
import { Button, Confetti, Owl } from '../../ui';
import styles from './PlayScreen.module.css';

export interface PlayScreenProps {
  // The player's seat (1-based) and how many play.
  seat: number;
  total: number;
  displayName: string | null;
  game: GameHostStatus;
  reconnecting: boolean;
  // Where the game's isolated container goes.
  frameRef?: Ref<HTMLDivElement>;
  onRetry(): void;
  onLeave(): void;
}

// Web presentation of Session Play: the game area (the GameHost puts the game there) with the
// player's seat, a leave action, and overlays while the game loads, after it fails, and while the
// connection is being re-established. Every text comes from the message catalogs.
export function PlayScreen({
  seat,
  total,
  displayName,
  game,
  reconnecting,
  frameRef,
  onRetry,
  onLeave,
}: PlayScreenProps) {
  const sound = useSound();
  useEffect(() => sound.play('game-start'), [sound]);
  const failed = game.phase === 'failed' ? game.error : null;
  useEffect(() => {
    if (failed) sound.play('error');
  }, [failed, sound]);
  const loading = game.phase === 'loading' || game.phase === 'starting';

  return (
    <div className={styles.play}>
      <div className={styles.toolbar}>
        <span className={styles.seat}>
          <FormattedMessage id="play.seat" values={{ seat, total }} />
        </span>
        <Button variant="ghost" onClick={onLeave} sound="leave">
          <FormattedMessage id="play.leave" />
        </Button>
      </div>
      <div className={styles.area}>
        <div className={styles.frame} ref={frameRef} />
        {loading && (
          <div className={styles.overlay} role="status" aria-live="polite">
            <Confetti />
            <Owl size={104} mood="surprised" entrance="hop" />
            <h1 className={styles.title}>
              <FormattedMessage id="started.title" />
            </h1>
            <p className={styles.lead}>
              {displayName ? (
                <FormattedMessage
                  id="started.bodyNamed"
                  values={{ name: displayName, seat, total }}
                />
              ) : (
                <FormattedMessage id="started.body" values={{ seat, total }} />
              )}
            </p>
          </div>
        )}
        {failed && (
          <div className={styles.overlay} role="alert">
            <Owl size={96} mood="sleepy" />
            <h1 className={styles.title}>
              <FormattedMessage id="play.failed.title" />
            </h1>
            <p className={styles.lead}>
              <FormattedMessage id={failureMessage(failed)} />
            </p>
            <div className={styles.actions}>
              <Button onClick={onRetry}>
                <FormattedMessage id="play.failed.retry" />
              </Button>
              <Button variant="secondary" onClick={onLeave} sound="leave">
                <FormattedMessage id="lobby.leave" />
              </Button>
            </div>
          </div>
        )}
        {reconnecting && !failed && (
          <div className={styles.banner} role="status" aria-live="polite">
            <FormattedMessage id="play.reconnecting" />
          </div>
        )}
      </div>
    </div>
  );
}

function failureMessage(error: GameHostError) {
  switch (error.kind) {
    case 'artifact-unreachable':
      return 'play.failed.unreachable';
    case 'unsupported-bridge-version':
      return 'play.failed.outdated';
    default:
      return 'play.failed.broken';
  }
}
