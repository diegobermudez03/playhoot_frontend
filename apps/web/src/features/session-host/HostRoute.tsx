import {
  canStart,
  createHostSession,
  type HostLobbyMember,
  type HostOutcome,
  type HostSession,
  type HostSessionState,
  type HostView,
} from '@playhoot/feature-session-host';
import { operations } from '@playhoot/protocol';
import { useEffect, useState, type CSSProperties } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { AppShell, Avatar, Button, Card, CodeTiles, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout, type Layout } from '../layout';
import { enterCodePath, joinPath, sessionPlayPath } from '../paths';
import { PlayerSession } from '../session-join/SessionRoute';
import { HostGameView } from './HostGameView';
import styles from './HostScreen.module.css';

// `/sessions/:sessionUUID/host?code=…`: the creator's screen of their Session (session-play-v1
// CHECKLIST P). One admin connection while the route is open; reloading rebuilds it from the URL.
export function HostRoute() {
  return (
    <RequireOperation operation={operations.joinSessionAsAdmin}>
      <HostSessionRoute />
    </RequireOperation>
  );
}

function HostSessionRoute() {
  const { sessionUUID = '' } = useParams();
  const [search] = useSearchParams();
  const host = useHostSession(sessionUUID, search.get('code'));
  if (!host) return <AppShell>{null}</AppShell>;
  return <HostScreen host={host} />;
}

function useHostSession(sessionUUID: string, joinCode: string | null): HostSession | null {
  const services = useServices();
  const [host, setHost] = useState<HostSession | null>(null);
  useEffect(() => {
    const next = createHostSession(sessionUUID, joinCode, {
      app: services.app,
      connector: services.admins,
    });
    // The instance owns a connection, so it is created here and not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setHost(next);
    next.start();
    return () => next.dispose();
  }, [sessionUUID, joinCode, services]);
  return host;
}

function HostScreen({ host }: { host: HostSession }) {
  const state = useStore(host.store);
  const layout = useLayout();
  const { view } = state;

  // The creator plays from here: the player's screens, with the host's controls above.
  if (state.playing && view.phase !== 'closed') {
    return (
      <PlayerSession
        target={{ kind: 'session', sessionUUID: state.sessionUUID }}
        embedded={{
          joinCode: state.joinCode,
          onLeft: host.stopPlaying,
          header: <HostBar host={host} state={state} />,
        }}
      />
    );
  }

  return (
    <AppShell>
      {view.phase === 'connecting' && <Waiting reconnecting={view.reconnectAttempt > 0} />}
      {view.phase === 'lobby' && (
        <LobbyStep host={host} state={state} view={view} layout={layout} />
      )}
      {view.phase === 'started' && <StartedStep host={host} state={state} view={view} />}
      {view.phase === 'closed' && <ClosedStep host={host} outcome={view.outcome} />}
    </AppShell>
  );
}

function Waiting({ reconnecting }: { reconnecting: boolean }) {
  return (
    <Stage>
      <div className={styles.hero}>
        <Owl size={112} animated />
        <p className={styles.lead}>
          <FormattedMessage id={reconnecting ? 'host.reconnecting' : 'host.connecting'} />
        </p>
      </div>
    </Stage>
  );
}

function LobbyStep({
  host,
  state,
  view,
  layout,
}: {
  host: HostSession;
  state: HostSessionState;
  view: Extract<HostView, { phase: 'lobby' }>;
  layout: Layout;
}) {
  const intl = useIntl();
  const ready = canStart(view);
  return (
    <Stage wide>
      <div className={styles.lobbyHeader}>
        <h1 className={styles.title}>
          <FormattedMessage id="host.lobby.title" />
        </h1>
        <p className={styles.lead}>
          <span className={styles.pulse} aria-hidden="true" />
          <FormattedMessage id="host.lobby.lead" />
        </p>
      </div>
      <div
        className={
          layout === 'wide' ? `${styles.lobbyGrid} ${styles.lobbyGridWide}` : styles.lobbyGrid
        }
      >
        <Invite sessionUUID={state.sessionUUID} joinCode={state.joinCode} />
        <Players members={view.members} />
      </div>
      <div className={styles.controls}>
        <Button
          size="lg"
          block
          disabled={!ready}
          loading={view.starting}
          onClick={() => void host.startGame()}
          sound="game-start"
        >
          <FormattedMessage id="host.start" />
        </Button>
        <p className={styles.hint}>{startHint(intl, view)}</p>
        {view.startError && (
          <p className={styles.error} role="alert">
            <FormattedMessage id={`host.startError.${view.startError}`} />
          </p>
        )}
        <Button variant="secondary" block onClick={host.playToo}>
          <FormattedMessage id="host.playToo" />
        </Button>
        <CancelControl host={host} cancelling={state.cancelling} />
      </div>
    </Stage>
  );
}

function startHint(intl: IntlShape, view: Extract<HostView, { phase: 'lobby' }>): string {
  const count = view.members.length;
  if (view.minPlayers !== null && count < view.minPlayers)
    return intl.formatMessage({ id: 'host.start.needMore' }, { count: view.minPlayers - count });
  if (view.maxPlayers !== null && view.maxPlayers > 0 && count > view.maxPlayers)
    return intl.formatMessage({ id: 'host.start.tooMany' }, { max: view.maxPlayers });
  if (count === 0) return intl.formatMessage({ id: 'host.start.nobody' });
  if (view.minPlayers !== null && view.maxPlayers !== null)
    return intl.formatMessage(
      { id: 'host.start.range' },
      { min: view.minPlayers, max: view.maxPlayers },
    );
  return '';
}

function Invite({ sessionUUID, joinCode }: { sessionUUID: string; joinCode: string | null }) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const path = joinCode ? joinPath(joinCode) : sessionPlayPath(sessionUUID);
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: nothing to show beyond the code itself.
    }
  };
  return (
    <Card className={styles.inviteCard}>
      <h2 className={styles.cardTitle}>
        <FormattedMessage id="lobby.invite.title" />
      </h2>
      {joinCode ? (
        <>
          <p className={styles.muted}>
            <FormattedMessage id="lobby.invite.withCode" />
          </p>
          <div
            className={styles.codeRow}
            role="img"
            aria-label={intl.formatMessage(
              { id: 'lobby.invite.codeLabel' },
              { code: joinCode.split('').join(' ') },
            )}
          >
            <CodeTiles code={joinCode} size="lg" />
          </div>
        </>
      ) : (
        <p className={styles.muted}>
          <FormattedMessage id="lobby.invite.withoutCode" />
        </p>
      )}
      <Button variant="secondary" block onClick={() => void copy()} sound="copy">
        <FormattedMessage id={copied ? 'lobby.invite.copied' : 'lobby.invite.copy'} />
      </Button>
    </Card>
  );
}

function Players({ members }: { members: HostLobbyMember[] }) {
  const intl = useIntl();
  return (
    <Card className={styles.playersCard}>
      <div className={styles.playersHead}>
        <h2 className={styles.cardTitle}>
          <FormattedMessage id="lobby.players" />
        </h2>
        <span key={members.length} className={`${styles.count} motion-bump`}>
          {intl.formatNumber(members.length)}
        </span>
      </div>
      <ul className={styles.players}>
        {members.map((member, index) => {
          const name =
            member.displayName ||
            intl.formatMessage({ id: 'lobby.playerName' }, { seat: index + 1 });
          return (
            <li
              key={member.userUUID}
              className={member.isYou ? `${styles.player} ${styles.you}` : styles.player}
              style={{ '--motion-index': index } as CSSProperties}
            >
              <Avatar seat={index + 1} label={name} highlighted={member.isYou} />
              <span className={styles.playerName}>{name}</span>
              {member.isYou && (
                <span className={styles.badge}>
                  <FormattedMessage id="lobby.you" />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Cancelling ends the Session for everyone, so it asks once more.
function CancelControl({ host, cancelling }: { host: HostSession; cancelling: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        <FormattedMessage id="host.cancel" />
      </Button>
    );
  }
  return (
    <div className={styles.confirm}>
      <span className={styles.hint}>
        <FormattedMessage id="host.cancel.confirm" />
      </span>
      <Button variant="danger" loading={cancelling} onClick={() => void host.cancel()}>
        <FormattedMessage id="host.cancel.yes" />
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        <FormattedMessage id="host.cancel.no" />
      </Button>
    </div>
  );
}

// The host's controls over the player's screens when the creator plays: start while in the lobby,
// cancel always. They go through the admin connection, not the player's.
function HostBar({ host, state }: { host: HostSession; state: HostSessionState }) {
  const { view } = state;
  return (
    <div className={styles.hostBar}>
      <span className={styles.hostBarLabel}>
        <FormattedMessage id="host.bar.label" />
      </span>
      {view.phase === 'lobby' && (
        <Button
          size="md"
          disabled={!canStart(view)}
          loading={view.starting}
          onClick={() => void host.startGame()}
        >
          <FormattedMessage id="host.start" />
        </Button>
      )}
      <CancelControl host={host} cancelling={state.cancelling} />
    </div>
  );
}

function StartedStep({
  host,
  state,
  view,
}: {
  host: HostSession;
  state: HostSessionState;
  view: Extract<HostView, { phase: 'started' }>;
}) {
  const intl = useIntl();
  return (
    <div className={styles.watch}>
      {view.connection === 'reconnecting' && (
        <p className={styles.hint}>
          <FormattedMessage id="host.reconnecting" />
        </p>
      )}
      {state.watchBlocked ? (
        <p className={styles.lead}>
          <FormattedMessage id="host.watch.blocked" />
        </p>
      ) : (
        <div className={styles.perspectives} role="group">
          <span className={styles.hostBarLabel}>
            <FormattedMessage id="host.watch.label" />
          </span>
          {view.session.participants.map((p, index) => {
            const name =
              p.displayName || intl.formatMessage({ id: 'lobby.playerName' }, { seat: index + 1 });
            return (
              <button
                key={p.participantId}
                type="button"
                className={styles.perspective}
                aria-pressed={view.watching === p.participantId}
                onClick={() => void host.watch(p.participantId)}
              >
                <Avatar seat={index + 1} label={name} />
                {name}
              </button>
            );
          })}
        </div>
      )}
      {!state.watchBlocked && view.watching && (
        <HostGameView session={view.session} watching={view.watching} live={host.live} />
      )}
      <div className={styles.controls}>
        <CancelControl host={host} cancelling={state.cancelling} />
      </div>
    </div>
  );
}

function ClosedStep({ host, outcome }: { host: HostSession; outcome: HostOutcome }) {
  const navigate = useNavigate();
  const { message, retry } = closedCopy(outcome);
  return (
    <Stage>
      <div className={styles.hero}>
        <Owl size={112} mood={outcome.kind === 'ended' ? 'happy' : 'surprised'} />
        <h1 className={styles.title}>
          <FormattedMessage id={message} />
        </h1>
      </div>
      <div className={styles.controls}>
        {retry && (
          <Button size="lg" block onClick={host.retry}>
            <FormattedMessage id="host.closed.retry" />
          </Button>
        )}
        <Button variant="secondary" block onClick={() => navigate(enterCodePath)}>
          <FormattedMessage id="host.closed.home" />
        </Button>
      </div>
    </Stage>
  );
}

// What the creator reads when the host screen is over, and whether trying again can help.
// Known refusals get their own text; an unknown one is unexpected (backend-contract-values.md).
function closedCopy(outcome: HostOutcome): { message: MessageId; retry: boolean } {
  switch (outcome.kind) {
    case 'ended':
      return {
        message:
          outcome.endCause === 'HOST_CANCELLED' ? 'host.closed.cancelled' : 'host.closed.ended',
        retry: false,
      };
    case 'unreachable':
      return { message: 'host.closed.unreachable', retry: true };
    case 'connection-lost':
      return { message: 'host.closed.lost', retry: true };
    case 'protocol-error':
      return { message: 'host.closed.protocol', retry: false };
    case 'rejected':
      switch (outcome.reason) {
        case 'session_ended':
          return { message: 'host.closed.ended', retry: false };
        case 'not_creator':
          return { message: 'host.closed.rejected', retry: false };
        // A limit was reached: never an unexpected error, the person waits (decided by the human).
        case 'rate_limited':
        case 'too_many_connections':
        case 'server_busy':
          return { message: 'outcome.limitReached.title', retry: true };
        case 'too_many_admins':
          return { message: 'host.closed.tooManyAdmins', retry: true };
        case 'invalid_session':
          return { message: 'outcome.invalidSession.title', retry: false };
        case 'session_unavailable':
          return { message: 'outcome.lobbyExpired.title', retry: false };
        default:
          return { message: 'outcome.unexpected.title', retry: true };
      }
  }
}
