import {
  parsePastedChange,
  type GameAuthoring,
  type PastedChangeError,
} from '@playhoot/feature-game-authoring';
import { useId, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { Button, Card } from '../../../ui';
import { ActionResultNotice } from '../ActionResultNotice';
import { DiagnosticList } from '../DiagnosticList';
import styles from '../GameWorkspace.module.css';

// "Cambios de mi IA": paste the change an AI wrote, see what it will do, apply it; and the latest
// attempts with why they were refused, which the AI also reads.
export function AiChangesSection({ authoring }: { authoring: GameAuthoring }) {
  const intl = useIntl();
  const id = useId();
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const busy = useStore(authoring.store, (state) => state.busy);
  const result = useStore(authoring.store, (state) => state.result);
  const [text, setText] = useState('');
  const parsed = useMemo(
    () =>
      parsePastedChange(
        text,
        draft.files.map((file) => file.path),
      ),
    [text, draft.files],
  );

  const apply = async () => {
    if (!parsed.ok) return;
    const answer = await authoring.applyChange(parsed.change);
    if (answer.kind === 'applied' || answer.kind === 'unchanged') setText('');
  };

  return (
    <div className={styles.sectionStack}>
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="section.ai" />
        </h2>
        <p className={styles.muted}>
          <FormattedMessage id="ai.intro" />
        </p>
        <label className={styles.fieldLabel} htmlFor={id}>
          <FormattedMessage id="ai.pasteLabel" />
        </label>
        <textarea
          id={id}
          className={styles.code}
          rows={10}
          spellCheck={false}
          value={text}
          placeholder={intl.formatMessage({ id: 'ai.placeholder' })}
          onChange={(event) => setText(event.target.value)}
          data-testid="paste-change"
        />
        {text.trim() !== '' && !parsed.ok && (
          <p className={styles.errorText} role="alert" data-testid="paste-error">
            <PasteError error={parsed.error} />
          </p>
        )}
        {parsed.ok && (
          <div className={styles.summary} data-testid="change-summary">
            <p className={styles.summaryTitle}>
              <FormattedMessage id="ai.summary.title" />
            </p>
            <SummaryLine id="ai.summary.added" paths={parsed.summary.added} />
            <SummaryLine id="ai.summary.modified" paths={parsed.summary.modified} />
            <SummaryLine id="ai.summary.deleted" paths={parsed.summary.deleted} />
            {parsed.change.baseRevision !== draft.currentRevision && (
              <p className={styles.warningText}>
                <FormattedMessage
                  id="ai.summary.baseMismatch"
                  values={{ base: parsed.change.baseRevision, current: draft.currentRevision }}
                />
              </p>
            )}
          </div>
        )}
        <Button
          size="lg"
          block
          disabled={!parsed.ok || busy !== null}
          loading={busy === 'change'}
          onClick={() => void apply()}
          data-testid="apply-change"
        >
          <FormattedMessage id="ai.apply" />
        </Button>
        {result && <ActionResultNotice result={result} authoring={authoring} />}
      </Card>
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="attempts.title" />
        </h2>
        {draft.attempts.length === 0 ? (
          <p className={styles.muted}>
            <FormattedMessage id="attempts.empty" />
          </p>
        ) : (
          <ul className={styles.list} data-testid="attempts">
            {draft.attempts.map((attempt, index) => (
              <li key={index} className={styles.listItem}>
                <div className={styles.listRow}>
                  <strong>
                    <FormattedMessage id="attempts.kind" values={{ kind: attempt.kind }} />
                  </strong>
                  <span className={styles.muted}>
                    <FormattedMessage id="attempts.outcome" values={{ outcome: attempt.outcome }} />
                  </span>
                  <span className={styles.muted}>
                    {intl.formatDate(attempt.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {attempt.diagnostics.length > 0 && (
                  <DiagnosticList
                    items={attempt.diagnostics.map((diagnostic) => ({
                      where: diagnostic.path,
                      code: diagnostic.code,
                      message: diagnostic.message,
                    }))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryLine({
  id,
  paths,
}: {
  id: 'ai.summary.added' | 'ai.summary.modified' | 'ai.summary.deleted';
  paths: string[];
}) {
  if (paths.length === 0) return null;
  return (
    <div className={styles.summaryLine}>
      <FormattedMessage id={id} values={{ count: paths.length }} />
      <ul className={styles.pathList}>
        {paths.map((path) => (
          <li key={path}>
            <code>{path}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PasteError({ error }: { error: PastedChangeError }) {
  switch (error.kind) {
    case 'not-json':
      return <FormattedMessage id="ai.error.notJson" />;
    case 'wrong-format':
      return <FormattedMessage id="ai.error.wrongFormat" />;
    case 'malformed':
      return <FormattedMessage id="ai.error.malformed" values={{ field: error.field }} />;
    case 'repeated-path':
      return <FormattedMessage id="ai.error.repeatedPath" values={{ path: error.path }} />;
    default:
      return <FormattedMessage id="ai.error.notAnEnvelope" />;
  }
}
