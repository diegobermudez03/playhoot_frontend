import type { SessionTarget } from '@playhoot/communication';
import { createJoinSession, type JoinSession } from '@playhoot/feature-session-join';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import { useAuth, useServices } from '../../app/ServicesContext';
import { DevIdentityPicker } from '../../dev/DevIdentityPicker';
import { AppShell } from '../../ui';
import { enterCodePath, joinPath, sessionPlayPath } from '../paths';
import { SessionPlayView } from '../session-play/SessionPlayView';
import { SessionScreen } from './SessionScreen';

// Serves both Session URLs (ADR-0002): `/join/:joinCode` and `/sessions/:sessionUUID/play`.
// One Join Session instance lives while the URL keeps pointing at the same Session, so
// replacing the code URL by the UUID URL keeps the connection; any other change, or leaving
// the route, disposes it and the next one rebuilds from URL + backend.
export function SessionRoute() {
  const target = useTarget();
  const join = useJoinSession(target);
  if (!join) return <AppShell>{null}</AppShell>;
  return <SessionView join={join} />;
}

function SessionView({ join }: { join: JoinSession }) {
  const state = useStore(join.store);
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const target = state.target;
  const joinCode = target.kind === 'joinCode' ? target.joinCode.toUpperCase() : null;

  // Once the Session is known, the URL names it, so refresh and reconnection work after the
  // start releases the code. Replace, so going back does not return to a dead code URL.
  useEffect(() => {
    if (!state.sessionUUID) return;
    const path = sessionPlayPath(state.sessionUUID);
    if (location.pathname !== path) navigate(path, { replace: true });
  }, [state.sessionUUID, location.pathname, navigate]);

  useEffect(() => {
    if (state.view.phase === 'closed' && state.view.outcome.kind === 'left')
      navigate(enterCodePath);
  }, [state.view, navigate]);

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

  return (
    <AppShell>
      <SessionScreen
        state={state}
        joinCode={joinCode}
        displayName={displayName}
        actions={{
          submitDisplayName: (name) => void join.submitDisplayName(name),
          retry: join.retry,
          leave: join.leave,
          enterAnotherCode: () => navigate(enterCodePath),
          copyInvite,
        }}
        devIdentity={import.meta.env.DEV ? <DevIdentityPicker onPicked={join.retry} /> : undefined}
        renderPlay={(view) => (
          <SessionPlayView
            view={view}
            live={join.live}
            displayName={displayName}
            onLeave={join.leave}
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
      identity: services.identity,
      connector: services.sessions,
      newIdempotencyKey: () => crypto.randomUUID(),
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
