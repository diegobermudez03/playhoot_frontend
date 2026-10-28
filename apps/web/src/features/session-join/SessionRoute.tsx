import type { SessionTarget } from '@playhoot/communication';
import {
  createJoinSession,
  type JoinOutcome,
  type JoinSession,
} from '@playhoot/feature-session-join';
import { operations } from '@playhoot/protocol';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { AppShell } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { enterCodePath, joinPath, sessionPlayPath } from '../paths';
import { SessionPlayView } from '../session-play/SessionPlayView';
import { SessionScreen } from './SessionScreen';

// Serves both Session URLs (ADR-0002): `/join/:joinCode` and `/sessions/:sessionUUID/play`.
// One Join Session instance lives while the URL keeps pointing at the same Session, so
// replacing the code URL by the UUID URL keeps the connection; any other change, or leaving
// the route, disposes it and the next one rebuilds from URL + backend. Joining needs an identity
// the backend accepts for playing: without one, the person is sent to authenticate and back here.
export function SessionRoute() {
  return (
    <RequireOperation operation={operations.joinSessionAsPlayer}>
      <JoinSessionRoute />
    </RequireOperation>
  );
}

function JoinSessionRoute() {
  return <PlayerSession target={useTarget()} />;
}

// The player's side of a Session inside another screen (the creator who also plays, from the host
// screen): it never changes the URL, and says when the player's part ended instead of navigating.
export interface EmbeddedPlayer {
  // The code to show and share in the player's lobby.
  joinCode: string | null;
  // How the player's part ended: a leave, or a refusal or failure the host may want to show.
  onLeft(outcome: JoinOutcome): void;
  // This player connection reached the lobby (each time it does).
  onLobby(): void;
  // Shown above the player's screens (the host's controls).
  header: ReactNode;
}

export function PlayerSession({
  target,
  embedded,
}: {
  target: SessionTarget;
  embedded?: EmbeddedPlayer;
}) {
  const join = useJoinSession(target);
  if (!join) return <AppShell>{null}</AppShell>;
  return <SessionView join={join} embedded={embedded} />;
}

function SessionView({
  join,
  embedded,
}: {
  join: JoinSession;
  embedded: EmbeddedPlayer | undefined;
}) {
  const state = useStore(join.store);
  const auth = useAuth();
  const layout = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const target = state.target;
  const joinCode =
    embedded?.joinCode ?? (target.kind === 'joinCode' ? target.joinCode.toUpperCase() : null);

  // Once the Session is known, the URL names it, so refresh and reconnection work after the
  // start releases the code. Replace, so going back does not return to a dead code URL.
  useEffect(() => {
    if (!state.sessionUUID || embedded) return;
    const path = sessionPlayPath(state.sessionUUID);
    if (location.pathname !== path) navigate(path, { replace: true });
  }, [state.sessionUUID, location.pathname, navigate, embedded]);

  const onLeft = embedded?.onLeft;
  const onLobby = embedded?.onLobby;
  const inLobby = state.view.phase === 'lobby';
  useEffect(() => {
    if (inLobby) onLobby?.();
  }, [inLobby, onLobby]);
  // Embedded, any end of the player's part (a leave, a refusal, a stopped game) goes back to the
  // host; as a route, only a leave navigates away (other endings show their outcome).
  useEffect(() => {
    if (state.view.phase !== 'closed') return;
    if (onLeft) onLeft(state.view.outcome);
    else if (state.view.outcome.kind === 'left') navigate(enterCodePath);
  }, [state.view, navigate, onLeft]);

  const copyInvite = useCallback(async () => {
    const path = joinCode
      ? joinPath(joinCode)
      : state.sessionUUID
        ? sessionPlayPath(state.sessionUUID)
        : location.pathname;
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      return true;
    } catch {
      return false;
    }
  }, [joinCode, state.sessionUUID, location.pathname]);

  const displayName =
    auth.status === 'guest' || auth.status === 'authenticated' ? auth.displayName : null;

  // The game takes the whole screen on a landscape display (plan §6, §8).
  return (
    <AppShell immersive={state.view.phase === 'started' && layout === 'wide'}>
      {embedded?.header}
      <SessionScreen
        state={state}
        layout={layout}
        joinCode={joinCode}
        displayName={displayName}
        actions={{
          retry: join.retry,
          leave: join.leave,
          enterAnotherCode: () => navigate(enterCodePath),
          copyInvite,
        }}
        renderPlay={(view) => (
          <SessionPlayView
            view={view}
            live={join.live}
            displayName={displayName}
            layout={layout}
            onLeave={() => join.leave()}
            onGameStopped={() => join.leave('game-stopped')}
          />
        )}
      />
    </AppShell>
  );
}

function useTarget(): SessionTarget {
  const { joinCode, sessionUUID } = useParams();
  if (sessionUUID) return { kind: 'session', sessionUUID };
  return { kind: 'joinCode', joinCode: joinCode ?? '' };
}

function useJoinSession(target: SessionTarget): JoinSession | null {
  const services = useServices();
  const current = useRef<JoinSession | null>(null);
  const [join, setJoin] = useState<JoinSession | null>(null);
  const key = target.kind === 'session' ? `s:${target.sessionUUID}` : `c:${target.joinCode}`;

  useEffect(() => {
    const existing = current.current;
    if (existing && pointsAtSameSession(existing, target)) return;
    existing?.dispose();
    const next = createJoinSession(target, {
      app: services.app,
      connector: services.sessions,
      onTelemetry: services.telemetry.join,
    });
    current.current = next;
    setJoin(next);
    next.start();
    // The instance is kept across URL changes on purpose; disposal happens below on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, services]);

  useEffect(
    () => () => {
      current.current?.dispose();
      current.current = null;
    },
    [],
  );

  return join;
}

function pointsAtSameSession(join: JoinSession, target: SessionTarget): boolean {
  const state = join.store.getState();
  if (target.kind === 'session') return state.sessionUUID === target.sessionUUID;
  return state.target.kind === 'joinCode' && state.target.joinCode === target.joinCode;
}
