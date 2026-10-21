import type { GameHostError, GameHostStatus } from '@playhoot/game-host';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { FormattedMessage } from 'react-intl';

import { useSound } from '../../sound';
import { Avatar, Button, Confetti, Owl } from '../../ui';
import styles from './PlayScreen.module.css';

export type PlayerStatus = 'active' | 'reconnecting' | 'disconnected' | 'left' | 'unknown';

// One participant as the roster shows them; `name` is already resolved (or a seat fallback).
export interface RosterPlayer {
  seat: number;
  name: string;
  hasName: boolean;
  isYou: boolean;
  status: PlayerStatus;
}

export interface PlayScreenProps {
  // The player's seat (1-based) and how many play.
  seat: number;
  total: number;
  displayName: string | null;
  players: RosterPlayer[];
  // Opens the players list from the start (style guide).
  initialRosterOpen?: boolean;
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
  players,
  initialRosterOpen = false,
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
        <Roster seat={seat} total={total} players={players} initiallyOpen={initialRosterOpen} />
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

// The seat chip, which opens the list of players with whether each one is playing.
function Roster({
  seat,
  total,
  players,
  initiallyOpen,
}: {
  seat: number;
  total: number;
  players: RosterPlayer[];
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const sound = useSound();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.roster} ref={root}>
      <button
        type="button"
        className={styles.seat}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          sound.play('tap');
          setOpen((value) => !value);
        }}
      >
        <FormattedMessage id="play.seat" values={{ seat, total }} />
        <span className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <h2 className={styles.panelTitle}>
            <FormattedMessage id="play.roster.title" />
          </h2>
          <ul className={styles.players}>
            {players.map((player) => (
              <li
                key={player.seat}
                className={
                  player.status === 'active' || player.status === 'reconnecting'
                    ? styles.player
                    : `${styles.player} ${styles.gone}`
                }
              >
                <Avatar
                  seat={player.seat}
                  label={player.name}
                  text={player.hasName ? undefined : String(player.seat)}
                  highlighted={player.isYou}
                />
                <span className={styles.playerName}>
                  {player.name}
                  {player.isYou && (
                    <span className={styles.you}>
                      <FormattedMessage id="lobby.you" />
                    </span>
                  )}
                </span>
                <span className={`${styles.status} ${styles[player.status]}`}>
                  <FormattedMessage id={`play.roster.status.${player.status}`} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
