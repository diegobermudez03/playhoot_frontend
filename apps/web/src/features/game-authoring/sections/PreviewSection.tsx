import {
  type GameAuthoring,
  type GamePreview,
  type PreviewEnd,
  type PreviewNotice,
  type PreviewStartFailure,
  type RunningPreview,
} from '@playhoot/feature-game-authoring';
import { createSessionPlay, type SessionPlay } from '@playhoot/feature-session-play';
import { buildStatuses, previewEndReasons, type PreviewEndReason } from '@playhoot/protocol';
import { useEffect, useId, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../../app/ServicesContext';
import { useLayout } from '../../layout';
import type { MessageId } from '../../../i18n/catalogs';
import { createIframeGameContainer } from '../../../platform/iframeGameContainer';
import { Button, Card } from '../../../ui';
import styles from '../GameWorkspace.module.css';

// "Probar juego": the creator plays a private test game of the current revision's build, as each
// synthetic participant in turn. The game runs in the same GameHost as a real Session's. The
// preview itself belongs to the workspace, so it keeps running while another section is open;
// coming back starts the GameHost again on its current view.
export function PreviewSection({
  authoring,
  preview,
  onOpenBuild,
}: {
  authoring: GameAuthoring;
  preview: GamePreview;
  onOpenBuild: () => void;
}) {
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const view = useStore(preview.store, (state) => state.view);
  const buildReady = draft.build?.status === buildStatuses.succeeded;

  if (view.phase === 'running') {
    return (
      <RunningPanel
        preview={preview}
        running={view.preview}
        draftRevision={draft.currentRevision}
        buildReady={buildReady}
      />
    );
  }
  return (
    <div className={styles.sectionStack}>
      {view.phase === 'ended' && <EndedNotice end={view.end} />}
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="section.preview" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="preview.intro" values={{ revision: draft.currentRevision }} />
        </p>
        <StartForm
          preview={preview}
          buildReady={buildReady}
          starting={view.phase === 'starting'}
          again={view.phase === 'ended'}
          onOpenBuild={onOpenBuild}
        />
      </Card>
    </div>
  );
}

function StartForm({
  preview,
  buildReady,
  starting,
  again,
  onOpenBuild,
}: {
  preview: GamePreview;
  buildReady: boolean;
  starting: boolean;
  again: boolean;
  onOpenBuild: () => void;
}) {
  const id = useId();
  const players = useStore(preview.store, (state) => state.players);
  const range = useStore(preview.store, (state) => state.range);
  const failure = useStore(preview.store, (state) => state.startFailure);

  return (
    <>
      <label className={styles.fieldLabel} htmlFor={id}>
        <FormattedMessage id="preview.players" />
      </label>
      <input
        id={id}
        className={styles.numberInput}
        type="number"
        min={range?.min ?? 1}
        {...(range?.max != null && { max: range.max })}
        value={players}
        onChange={(event) => preview.setPlayers(Number(event.target.value))}
        data-testid="preview-players"
      />
      {range && (range.min !== null || range.max !== null) && (
        <p className={styles.muted}>
          <FormattedMessage
            id="preview.range"
            values={{ min: range.min ?? 1, max: range.max ?? range.min ?? 1 }}
          />
        </p>
      )}
      {!buildReady && <BuildNotReady onOpenBuild={onOpenBuild} />}
      <Button
        size="lg"
        block
        disabled={!buildReady || starting}
        loading={starting}
        onClick={() => void preview.start()}
        data-testid="start-preview"
      >
        <FormattedMessage id={again ? 'preview.startAgain' : 'preview.start'} />
      </Button>
      {failure && <StartFailureNotice failure={failure} onOpenBuild={onOpenBuild} />}
    </>
  );
}

function BuildNotReady({ onOpenBuild }: { onOpenBuild: () => void }) {
  return (
    <div className={styles.notice} data-testid="preview-build-not-ready">
      <p>
        <FormattedMessage id="preview.buildNotReady" />
      </p>
      <div className={styles.noticeActions}>
        <Button variant="secondary" onClick={onOpenBuild}>
          <FormattedMessage id="preview.openBuild" />
        </Button>
      </div>
    </div>
  );
}

const startFailureMessages: Record<PreviewStartFailure['kind'], MessageId> = {
  'build-not-ready': 'preview.failed.buildNotReady',
  'invalid-players': 'preview.failed.invalidPlayers',
  'script-failure': 'preview.failed.scriptFailure',
  busy: 'preview.failed.busy',
  'not-found': 'preview.failed.notFound',
  'no-credential': 'preview.failed.unavailable',
  unavailable: 'preview.failed.unavailable',
};

function StartFailureNotice({
  failure,
  onOpenBuild,
}: {
  failure: PreviewStartFailure;
  onOpenBuild: () => void;
}) {
  return (
    <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
      <p>
        <FormattedMessage id={startFailureMessages[failure.kind]} />
      </p>
      {failure.kind === 'build-not-ready' && (
        <div className={styles.noticeActions}>
          <Button variant="secondary" onClick={onOpenBuild}>
            <FormattedMessage id="preview.openBuild" />
          </Button>
        </div>
      )}
    </div>
  );
}

const endMessages: Record<PreviewEndReason, MessageId> = {
  finished: 'preview.ended.finished',
  idle: 'preview.ended.idle',
  ended_by_owner: 'preview.ended.byOwner',
  replaced: 'preview.ended.replaced',
  script_failure: 'preview.ended.scriptFailure',
  unavailable: 'preview.ended.unavailable',
};

function endMessage(end: PreviewEnd): MessageId {
  if (end.kind === 'ended' && (previewEndReasons as readonly string[]).includes(end.reason)) {
    return endMessages[end.reason as PreviewEndReason];
  }
  if (end.kind === 'connection' && end.close === 'replaced') return 'preview.ended.replaced';
  return 'preview.ended.unavailable';
}

function EndedNotice({ end }: { end: PreviewEnd }) {
  const failed =
    end.kind !== 'ended' || end.reason === 'script_failure' || end.reason === 'unavailable';
  return (
    <div
      className={`${styles.notice} ${failed ? styles.noticeError : styles.noticeOk}`}
      role="status"
      data-testid="preview-ended"
    >
      <p>
        <FormattedMessage id={endMessage(end)} />
      </p>
    </div>
  );
}

const noticeMessages: Record<PreviewNotice['kind'], MessageId> = {
  'invalid-game-data': 'preview.notice.invalidGameData',
  'unknown-participant': 'preview.notice.unknownParticipant',
  other: 'preview.notice.other',
};

// A problem the backend reported while the preview goes on: the game keeps running.
function RunningNotice({ preview }: { preview: GamePreview }) {
  const notice = useStore(preview.store, (state) => state.notice);
  if (!notice) return null;
  return (
    <div
      className={`${styles.notice} ${styles.noticeError}`}
      role="alert"
      data-testid="preview-notice"
    >
      <p>
        <FormattedMessage id={noticeMessages[notice.kind]} />
      </p>
      {notice.detail && <p className={styles.diagnosticWhere}>{notice.detail}</p>}
      <div className={styles.noticeActions}>
        <Button variant="ghost" onClick={preview.dismissNotice}>
          <FormattedMessage id="preview.notice.dismiss" />
        </Button>
      </div>
    </div>
  );
}

function RunningPanel({
  preview,
  running,
  draftRevision,
  buildReady,
}: {
  preview: GamePreview;
  running: RunningPreview;
  draftRevision: number;
  buildReady: boolean;
}) {
  const intl = useIntl();
  const compact = useLayout() === 'compact';

  const game =
    running.frontend && running.actingAs ? (
      <PreviewGame
        preview={preview}
        running={running}
        actingAs={running.actingAs}
        compact={compact}
      />
    ) : (
      <p className={styles.muted}>
        <FormattedMessage id="preview.connecting" />
      </p>
    );
  const controls = (
    <Card className={compact ? styles.previewControlsCompact : styles.panel}>
      <div className={styles.previewBar}>
        <span className={styles.revisionChip} data-testid="preview-revision">
          <FormattedMessage id="preview.testing" values={{ revision: running.revision }} />
        </span>
        {running.paused && (
          <span className={styles.pausedChip} data-testid="preview-paused">
            <FormattedMessage id="preview.paused" />
          </span>
        )}
      </div>
      {draftRevision > running.revision && (
        <div className={styles.notice} data-testid="preview-outdated">
          <p>
            <FormattedMessage
              id="preview.outdated"
              values={{ tested: running.revision, current: draftRevision }}
            />
          </p>
        </div>
      )}
      <RunningNotice preview={preview} />
      <div
        className={styles.participants}
        role="group"
        aria-label={intl.formatMessage({ id: 'preview.actingAs' })}
      >
        {running.participants.map((participant) => (
          <button
            key={participant}
            type="button"
            className={[
              styles.participant,
              participant === running.actingAs && styles.participantActive,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={participant === running.actingAs}
            disabled={running.actingAs === null}
            onClick={() => preview.actAs(participant)}
            data-participant={participant}
          >
            {participant}
          </button>
        ))}
      </div>
      <div className={styles.rowActions}>
        {running.paused ? (
          <Button variant="secondary" onClick={preview.resume} data-testid="preview-resume">
            <FormattedMessage id="preview.resume" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={preview.pause} data-testid="preview-pause">
            <FormattedMessage id="preview.pause" />
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={!buildReady}
          onClick={() => void preview.start()}
          data-testid="preview-restart"
        >
          <FormattedMessage id="preview.restart" />
        </Button>
        <Button variant="ghost" onClick={preview.end} data-testid="preview-end">
          <FormattedMessage id="preview.end" />
        </Button>
      </div>
    </Card>
  );

  // On a phone the game comes first, at full width, and the controls follow in a compact bar.
  return (
    <div className={styles.sectionStack}>
      {compact ? game : controls}
      {compact ? controls : game}
    </div>
  );
}

// The acted-as participant's game. Another participant is a new game run, so what one showed on
// screen (a selected card, a half-typed answer) never appears for the next.
function PreviewGame({
  preview,
  running,
  actingAs,
  compact,
}: {
  preview: GamePreview;
  running: RunningPreview;
  actingAs: string;
  compact: boolean;
}) {
  const play = usePreviewPlay(preview, running, actingAs);
  const intl = useIntl();
  const frame = useRef<HTMLDivElement>(null);
  const frameTitle = intl.formatMessage({ id: 'play.gameFrame' });

  useEffect(() => {
    const parent = frame.current;
    if (!parent || !play) return;
    return play.attach(createIframeGameContainer(parent, frameTitle));
  }, [play, frameTitle]);

  return (
    <div
      className={compact ? styles.gameAreaCompact : styles.gameArea}
      // On a phone the frame takes the game's own shape, as wide as the screen.
      style={
        compact && running.frontend
          ? {
              aspectRatio: `${running.frontend.viewport.width} / ${running.frontend.viewport.height}`,
            }
          : undefined
      }
      data-testid="preview-game"
    >
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
        <FormattedMessage id="preview.loadingGame" />
      </p>
    );
  }
  if (game.phase !== 'failed') return null;
  return (
    <div className={styles.gameStatus}>
      <div className={styles.rowActions}>
        <FormattedMessage id="preview.gameFailed" />
        <Button variant="secondary" onClick={play.reload}>
          <FormattedMessage id="preview.reloadGame" />
        </Button>
      </div>
    </div>
  );
}

function usePreviewPlay(
  preview: GamePreview,
  running: RunningPreview,
  actingAs: string,
): SessionPlay | null {
  const services = useServices();
  const intl = useIntl();
  const [play, setPlay] = useState<SessionPlay | null>(null);
  const frontend = running.frontend!;
  const key = `${running.previewUUID}|${actingAs}|${frontend.sha256}`;

  useEffect(() => {
    const next = createSessionPlay(
      { participantId: actingAs, participants: running.participants, frontend },
      intl.locale,
      {
        live: preview.port(actingAs),
        loader: services.gameArtifacts,
        assets: services.gameAssets,
        // No play telemetry: a creator testing a draft would skew players' trends.
      },
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setPlay(next);
    return () => next.dispose();
    // One game run per preview, participant and frontend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, preview, services]);

  return play;
}
