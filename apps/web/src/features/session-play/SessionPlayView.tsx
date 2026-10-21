import type { JoinView, LiveSession } from '@playhoot/feature-session-join';
import { createSessionPlay, type SessionPlay } from '@playhoot/feature-session-play';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { createIframeGameContainer } from '../../platform/iframeGameContainer';
import { PlayScreen } from './PlayScreen';

type StartedView = Extract<JoinView, { phase: 'started' }>;

interface SessionPlayViewProps {
  view: StartedView;
  live: LiveSession;
  displayName: string | null;
  onLeave(): void;
}

// Session Play on the web: one feature instance per started game, kept while the same game runs
// (also across reconnections, which send `session_started` again) and disposed when the screen
// goes away.
export function SessionPlayView(props: SessionPlayViewProps) {
  const play = useSessionPlay(props.view, props.live);
  if (!play) return <Screen {...props} game={{ phase: 'loading' }} />;
  return <AttachedPlay {...props} play={play} />;
}

function AttachedPlay(props: SessionPlayViewProps & { play: SessionPlay }) {
  const { play } = props;
  const state = useStore(play.store);
  const intl = useIntl();
  const frame = useRef<HTMLDivElement>(null);
  const frameTitle = intl.formatMessage({ id: 'play.gameFrame' });

  useEffect(() => {
    const parent = frame.current;
    if (!parent) return;
    return play.attach(createIframeGameContainer(parent, frameTitle));
  }, [play, frameTitle]);

  return <Screen {...props} game={state.game} frameRef={frame} onRetry={play.reload} />;
}

function Screen({
  view,
  displayName,
  onLeave,
  game,
  frameRef,
  onRetry = () => undefined,
}: SessionPlayViewProps &
  Pick<Parameters<typeof PlayScreen>[0], 'game' | 'frameRef'> & {
    onRetry?: () => void;
  }) {
  return (
    <PlayScreen
      seat={view.session.participants.findIndex((p) => p.isYou) + 1}
      total={view.session.participants.length}
      displayName={displayName}
      game={game}
      reconnecting={view.connection === 'reconnecting'}
      {...(frameRef && { frameRef })}
      onRetry={onRetry}
      onLeave={onLeave}
    />
  );
}

function useSessionPlay(view: StartedView, live: LiveSession): SessionPlay | null {
  const services = useServices();
  const intl = useIntl();
  const [play, setPlay] = useState<SessionPlay | null>(null);
  const { participantId, participants, frontend } = view.session;
  const key = `${participantId}|${frontend.sha256}`;

  useEffect(() => {
    const next = createSessionPlay(
      { participantId, participants: participants.map((p) => p.participantId), frontend },
      intl.locale,
      {
        live,
        loader: services.gameArtifacts,
        ...(import.meta.env.DEV && { onTelemetry: (event) => console.debug('[game]', event) }),
      },
    );
    // The instance owns a lifecycle (dispose), so it is created here and not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlay(next);
    return () => next.dispose();
    // One instance per game (key); a reconnection re-sends the same start and keeps it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, services]);

  return play;
}
