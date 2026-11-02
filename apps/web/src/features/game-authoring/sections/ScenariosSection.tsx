import {
  createScenarioRunner,
  parsePastedScenario,
  type GameAuthoring,
  type PastedScenarioError,
  type ScenarioRunner,
} from '@playhoot/feature-game-authoring';
import type { GamesFailure, SimulationResult } from '@playhoot/communication';
import { buildStatuses } from '@playhoot/protocol';
import { useEffect, useId, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../../app/ServicesContext';
import { Button, Card } from '../../../ui';
import { DiagnosticList } from '../DiagnosticList';
import styles from '../GameWorkspace.module.css';

// "Escenarios": paste a scenario the person's AI wrote, run it against the build of the current
// revision, and copy the result back to the AI. Nothing is kept: the result lives only while this
// section is open.
export function ScenariosSection({
  authoring,
  onOpenBuild,
}: {
  authoring: GameAuthoring;
  onOpenBuild: () => void;
}) {
  const services = useServices();
  const gameUUID = useStore(authoring.store, (state) => state.draft!.gameUUID);
  const [runner, setRunner] = useState<ScenarioRunner | null>(null);
  useEffect(() => {
    const next = createScenarioRunner({ games: services.gamesApi, gameUUID });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setRunner(next);
    return () => next.dispose();
  }, [gameUUID, services]);
  if (!runner) return null;
  return <ScenariosPanel authoring={authoring} runner={runner} onOpenBuild={onOpenBuild} />;
}

function ScenariosPanel({
  authoring,
  runner,
  onOpenBuild,
}: {
  authoring: GameAuthoring;
  runner: ScenarioRunner;
  onOpenBuild: () => void;
}) {
  const intl = useIntl();
  const id = useId();
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const run = useStore(runner.store, (state) => state.run);
  const [text, setText] = useState('');
  const parsed = useMemo(() => parsePastedScenario(text), [text]);
  const buildReady = draft.build?.status === buildStatuses.succeeded;

  return (
    <div className={styles.sectionStack}>
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="section.scenarios" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="scenarios.intro" values={{ revision: draft.currentRevision }} />
        </p>
        <label className={styles.fieldLabel} htmlFor={id}>
          <FormattedMessage id="scenarios.pasteLabel" />
        </label>
        <textarea
          id={id}
          className={styles.code}
          rows={10}
          spellCheck={false}
          value={text}
          placeholder={intl.formatMessage({ id: 'scenarios.placeholder' })}
          onChange={(event) => setText(event.target.value)}
          data-testid="paste-scenario"
        />
        {text.trim() !== '' && !parsed.ok && (
          <p className={styles.errorText} role="alert" data-testid="scenario-paste-error">
            <PasteError error={parsed.error} />
          </p>
        )}
        {!buildReady && (
          <div className={styles.notice} data-testid="scenario-build-not-ready">
            <p>
              <FormattedMessage
                id="scenarios.buildNotReady"
                values={{ revision: draft.currentRevision }}
              />
            </p>
            <div className={styles.noticeActions}>
              <Button variant="secondary" onClick={onOpenBuild}>
                <FormattedMessage id="scenarios.openBuild" />
              </Button>
            </div>
          </div>
        )}
        <Button
          size="lg"
          block
          disabled={!parsed.ok || !buildReady || run.status === 'running'}
          loading={run.status === 'running'}
          onClick={() => parsed.ok && void runner.run(parsed.scenario)}
          data-testid="run-scenario"
        >
          <FormattedMessage id="scenarios.run" />
        </Button>
        {run.status === 'failed' && <RunFailure failure={run.failure} onOpenBuild={onOpenBuild} />}
      </Card>
      {run.status === 'done' && <ResultPanel result={run.result} onClear={runner.clear} />}
    </div>
  );
}

function ResultPanel({ result, onClear }: { result: SimulationResult; onClear: () => void }) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(result.raw, null, 2), [result.raw]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: the result stays on screen to copy by hand.
    }
  };

  return (
    <Card className={styles.panel} data-testid="scenario-result">
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="scenarios.result.title" />
      </h2>
      <div className={styles.summary}>
        {result.finished !== null && (
          <p>
            <FormattedMessage
              id="scenarios.result.finished"
              values={{ finished: result.finished ? 'yes' : 'no' }}
            />
          </p>
        )}
        {result.stopped && (
          <p className={styles.warningText}>
            <FormattedMessage id="scenarios.result.stopped" values={{ reason: result.stopped }} />
          </p>
        )}
        <p>
          <FormattedMessage
            id="scenarios.result.counts"
            values={{
              commands: result.commands,
              rejected: result.rejected,
              errors: result.errors,
            }}
          />
        </p>
        {result.scriptError && (
          <p className={styles.errorText}>
            <FormattedMessage
              id="scenarios.result.scriptError"
              values={{ message: result.scriptError }}
            />
          </p>
        )}
      </div>
      <div className={styles.rowActions}>
        <Button onClick={() => void copy()} data-testid="copy-scenario-result">
          <FormattedMessage id={copied ? 'scenarios.copied' : 'scenarios.copy'} />
        </Button>
        <Button variant="ghost" onClick={onClear}>
          <FormattedMessage id="scenarios.clear" />
        </Button>
      </div>
      <textarea
        className={styles.code}
        readOnly
        rows={16}
        spellCheck={false}
        value={json}
        aria-label={intl.formatMessage({ id: 'scenarios.resultLabel' })}
        data-testid="scenario-result-json"
      />
    </Card>
  );
}

function RunFailure({ failure, onOpenBuild }: { failure: GamesFailure; onOpenBuild: () => void }) {
  switch (failure.kind) {
    case 'build-not-ready':
      return (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <p>
            <FormattedMessage id="scenarios.failed.buildNotReady" />
          </p>
          <div className={styles.noticeActions}>
            <Button variant="secondary" onClick={onOpenBuild}>
              <FormattedMessage id="scenarios.openBuild" />
            </Button>
          </div>
        </div>
      );
    case 'invalid':
      return (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <p>
            <FormattedMessage id="scenarios.failed.invalid" />
          </p>
          <DiagnosticList
            items={failure.diagnostics.map((diagnostic) => ({
              where: diagnostic.path,
              code: diagnostic.code,
              message: diagnostic.message,
            }))}
          />
        </div>
      );
    case 'busy':
      return <Notice id="scenarios.failed.busy" />;
    case 'not-found':
      return <Notice id="scenarios.failed.notFound" />;
    default:
      return <Notice id="scenarios.failed.unavailable" />;
  }
}

function Notice({
  id,
}: {
  id: 'scenarios.failed.busy' | 'scenarios.failed.notFound' | 'scenarios.failed.unavailable';
}) {
  return (
    <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
      <p>
        <FormattedMessage id={id} />
      </p>
    </div>
  );
}

function PasteError({ error }: { error: PastedScenarioError }) {
  switch (error.kind) {
    case 'not-json':
      return <FormattedMessage id="scenarios.error.notJson" />;
    case 'wrong-format':
      return <FormattedMessage id="scenarios.error.wrongFormat" />;
    default:
      return <FormattedMessage id="scenarios.error.notAnEnvelope" />;
  }
}
