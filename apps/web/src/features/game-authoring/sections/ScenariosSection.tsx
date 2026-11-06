import {
  createScenarioRunner,
  parsePastedScenario,
  savedScenarioPaths,
  type GameAuthoring,
  type PastedScenarioError,
  type ScenarioRunner,
} from '@playhoot/feature-game-authoring';
import type {
  ExpectationOutcome,
  GamesFailure,
  SimulationBatch,
  SimulationResult,
} from '@playhoot/communication';
import { buildStatuses } from '@playhoot/protocol';
import { useEffect, useId, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../../app/ServicesContext';
import { Button, Card } from '../../../ui';
import { DiagnosticList } from '../DiagnosticList';
import styles from '../GameWorkspace.module.css';

// "Escenarios": run a scenario the person's AI wrote (pasted), one the project saves under
// scenarios/, or all of them, against the build of the current revision; see which expectations
// failed, inspect one state, and copy the result back to the AI.
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
  const saved = useMemo(
    () => savedScenarioPaths(draft.files.map((file) => file.path)),
    [draft.files],
  );
  const buildReady = draft.build?.status === buildStatuses.succeeded;
  const running = run.status === 'running';

  return (
    <div className={styles.sectionStack}>
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="section.scenarios" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="scenarios.intro" values={{ revision: draft.currentRevision }} />
        </p>
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
        <h3 className={styles.fieldLabel}>
          <FormattedMessage id="scenarios.saved.title" />
        </h3>
        {saved.length === 0 ? (
          <p className={styles.muted}>
            <FormattedMessage id="scenarios.saved.empty" />
          </p>
        ) : (
          <ul className={styles.list} data-testid="saved-scenarios">
            {saved.map((path) => (
              <li key={path} className={styles.listItem}>
                <div className={styles.listRow}>
                  <code>{path}</code>
                  <Button
                    size="md"
                    variant="secondary"
                    disabled={!buildReady || running}
                    onClick={() => void runner.runSaved(path)}
                    data-testid={`run-saved-${path}`}
                  >
                    <FormattedMessage id="scenarios.saved.run" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {saved.length > 1 && (
          <Button
            variant="secondary"
            disabled={!buildReady || running}
            onClick={() => void runner.runAll()}
            data-testid="run-all-scenarios"
          >
            <FormattedMessage id="scenarios.saved.runAll" />
          </Button>
        )}
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
        <Button
          size="lg"
          block
          disabled={!parsed.ok || !buildReady || running}
          loading={running}
          onClick={() => parsed.ok && void runner.run(parsed.scenario)}
          data-testid="run-scenario"
        >
          <FormattedMessage id="scenarios.run" />
        </Button>
        {run.status === 'failed' && <RunFailure failure={run.failure} onOpenBuild={onOpenBuild} />}
      </Card>
      {run.status === 'done' && run.answer.kind === 'single' && (
        <ResultPanel result={run.answer.result} runner={runner} onClear={runner.clear} />
      )}
      {run.status === 'done' && run.answer.kind === 'batch' && (
        <BatchPanel batch={run.answer.batch} runner={runner} onClear={runner.clear} />
      )}
    </div>
  );
}

function BatchPanel({
  batch,
  runner,
  onClear,
}: {
  batch: SimulationBatch;
  runner: ScenarioRunner;
  onClear: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const opened = batch.scenarios.find((scenario) => scenario.path === open)?.result ?? null;
  return (
    <>
      <Card className={styles.panel} data-testid="scenario-batch">
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="scenarios.batch.title" />
        </h2>
        <ul className={styles.list}>
          {batch.scenarios.map((scenario) => (
            <li key={scenario.path} className={styles.listItem}>
              <div className={styles.listRow}>
                <code>{scenario.path}</code>
                {scenario.result ? (
                  <PassedBadge passed={scenario.result.passed} />
                ) : (
                  <span className={`${styles.badge} ${styles.badgeError}`}>
                    <FormattedMessage id="scenarios.batch.invalid" />
                  </span>
                )}
                {scenario.result && (
                  <Button size="md" variant="ghost" onClick={() => setOpen(scenario.path)}>
                    <FormattedMessage id="scenarios.batch.open" />
                  </Button>
                )}
              </div>
              {scenario.diagnostics.length > 0 && (
                <DiagnosticList
                  items={scenario.diagnostics.map((diagnostic) => ({
                    where: diagnostic.field,
                    code: '',
                    message: diagnostic.message,
                  }))}
                />
              )}
            </li>
          ))}
        </ul>
        {batch.skipped.length > 0 && (
          <p className={styles.muted}>
            <FormattedMessage
              id="scenarios.batch.skipped"
              values={{ count: batch.skipped.length }}
            />
          </p>
        )}
        <CopyRaw raw={batch.raw} onClear={onClear} />
      </Card>
      {opened && <ResultPanel result={opened} runner={runner} onClear={() => setOpen(null)} />}
    </>
  );
}

function PassedBadge({ passed }: { passed: boolean | null }) {
  if (passed === null) {
    return (
      <span className={`${styles.badge} ${styles.badgeNeutral}`}>
        <FormattedMessage id="scenarios.result.noExpectations" />
      </span>
    );
  }
  return (
    <span className={`${styles.badge} ${passed ? styles.badgeOk : styles.badgeError}`}>
      <FormattedMessage id={passed ? 'scenarios.result.passed' : 'scenarios.result.failed'} />
    </span>
  );
}

function ResultPanel({
  result,
  runner,
  onClear,
}: {
  result: SimulationResult;
  runner: ScenarioRunner;
  onClear: () => void;
}) {
  return (
    <Card className={styles.panel} data-testid="scenario-result">
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="scenarios.result.title" />
      </h2>
      <div className={styles.summary}>
        <PassedBadge passed={result.passed} />
        {result.expectations && (
          <p>
            <FormattedMessage
              id="scenarios.result.expectations"
              values={{ passed: result.expectations.passed, total: result.expectations.total }}
            />
          </p>
        )}
        {result.expectations && result.expectations.failed.length > 0 && (
          <FailedExpectations failed={result.expectations.failed} />
        )}
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
      {result.resultId && (
        <StateInspector resultID={result.resultId} result={result} runner={runner} />
      )}
      <CopyRaw raw={result.raw} onClear={onClear} />
    </Card>
  );
}

// The failed expectations, as the backend checked them: technical details for the AI, shown as
// they came (user-facing-text.md, allowed exceptions).
function FailedExpectations({ failed }: { failed: ExpectationOutcome[] }) {
  const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));
  // What the expectation looked at, as the scenario wrote it.
  const where = (expectation: ExpectationOutcome) =>
    [expectation.of, expectation.path, expectation.op].join(' ');
  return (
    <ul className={styles.diagnostics} data-testid="failed-expectations">
      {failed.map((expectation) => (
        <li key={expectation.index} className={styles.diagnostic}>
          <code className={styles.diagnosticWhere}>{where(expectation)}</code>
          <span>
            <FormattedMessage
              id={
                expectation.notObserved
                  ? 'scenarios.expectation.notObserved'
                  : 'scenarios.expectation.failed'
              }
              values={{
                when: expectation.atMs === null ? 'end' : 'at',
                at: expectation.atMs ?? 0,
                expected: show(expectation.expected),
                actual: show(expectation.actual),
              }}
            />
          </span>
          {expectation.problem && <span>{expectation.problem}</span>}
        </li>
      ))}
    </ul>
  );
}

const endOfRun = 'end';

function StateInspector({
  resultID,
  result,
  runner,
}: {
  resultID: string;
  result: SimulationResult;
  runner: ScenarioRunner;
}) {
  const intl = useIntl();
  const inspection = useStore(runner.store, (state) => state.inspection);
  const [at, setAt] = useState(endOfRun);
  const [of, setOf] = useState('global');
  const [path, setPath] = useState('');
  const atId = useId();
  const ofId = useId();
  const pathId = useId();
  const ours = inspection?.resultID === resultID ? inspection : null;
  const state = ours?.state ?? null;

  return (
    <div className={styles.summary} data-testid="state-inspector">
      <p className={styles.summaryTitle}>
        <FormattedMessage id="scenarios.inspect.title" />
      </p>
      <div className={styles.listRow}>
        <label className={styles.fieldLabel} htmlFor={atId}>
          <FormattedMessage id="scenarios.inspect.at" />
        </label>
        <select id={atId} value={at} onChange={(event) => setAt(event.target.value)}>
          <option value={endOfRun}>{intl.formatMessage({ id: 'scenarios.inspect.end' })}</option>
          {result.observedAtMs.map((instant) => (
            <option key={instant} value={String(instant)}>
              {intl.formatMessage({ id: 'scenarios.inspect.instant' }, { ms: instant })}
            </option>
          ))}
        </select>
        <label className={styles.fieldLabel} htmlFor={ofId}>
          <FormattedMessage id="scenarios.inspect.of" />
        </label>
        <select id={ofId} value={of} onChange={(event) => setOf(event.target.value)}>
          <option value="global">{intl.formatMessage({ id: 'scenarios.inspect.global' })}</option>
          {result.players.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </select>
        <label className={styles.fieldLabel} htmlFor={pathId}>
          <FormattedMessage id="scenarios.inspect.path" />
        </label>
        <input
          id={pathId}
          className={styles.code}
          value={path}
          spellCheck={false}
          placeholder={intl.formatMessage({ id: 'scenarios.inspect.pathPlaceholder' })}
          onChange={(event) => setPath(event.target.value)}
          data-testid="inspect-path"
        />
        <Button
          size="md"
          variant="secondary"
          loading={ours?.status === 'loading'}
          onClick={() =>
            void runner.inspect(resultID, at === endOfRun ? null : Number(at), of, path.trim())
          }
          data-testid="inspect-state"
        >
          <FormattedMessage id="scenarios.inspect.read" />
        </Button>
      </div>
      {ours?.status === 'failed' && (
        <p className={styles.errorText} role="alert">
          <FormattedMessage id="scenarios.inspect.failed" />
        </p>
      )}
      {state?.status === 'missing' && (
        <p className={styles.warningText} role="alert">
          <FormattedMessage
            id="scenarios.inspect.missing"
            values={{
              reason:
                state.reason === 'not-observed'
                  ? 'notObserved'
                  : state.reason === 'path-not-found'
                    ? 'pathNotFound'
                    : state.reason,
            }}
          />
        </p>
      )}
      {state?.status === 'found' && state.tooLarge && (
        <p className={styles.warningText}>
          <FormattedMessage
            id="scenarios.inspect.tooLarge"
            values={{
              size: state.size ?? 0,
              keys: state.keys.join(', '),
              shape: state.length === null ? 'object' : 'array',
              length: state.length ?? 0,
            }}
          />
        </p>
      )}
      {state?.status === 'found' && !state.tooLarge && (
        <pre className={styles.diff} data-testid="inspected-value">
          {JSON.stringify(state.value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function CopyRaw({ raw, onClear }: { raw: unknown; onClear: () => void }) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(raw, null, 2), [raw]);

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
    <>
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
        rows={12}
        spellCheck={false}
        value={json}
        aria-label={intl.formatMessage({ id: 'scenarios.resultLabel' })}
        data-testid="scenario-result-json"
      />
    </>
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
