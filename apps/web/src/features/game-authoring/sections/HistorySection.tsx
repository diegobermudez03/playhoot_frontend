import type { DraftRevision } from '@playhoot/communication';
import type { GameAuthoring, RevisionComparison } from '@playhoot/feature-game-authoring';
import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { Button, Card } from '../../../ui';
import { ActionResultNotice } from '../ActionResultNotice';
import styles from '../GameWorkspace.module.css';

// "Historial": every revision, newest first, with where it came from; what each one changed or
// how it differs from the current one; restoring one makes a new revision with its files and
// assets.
export function HistorySection({ authoring }: { authoring: GameAuthoring }) {
  const intl = useIntl();
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const revisions = useStore(authoring.store, (state) => state.revisions);
  const olderRevisions = useStore(authoring.store, (state) => state.olderRevisions);
  const comparison = useStore(authoring.store, (state) => state.comparison);
  const busy = useStore(authoring.store, (state) => state.busy);
  const result = useStore(authoring.store, (state) => state.result);

  useEffect(() => {
    void authoring.loadRevisions();
  }, [authoring, draft.currentRevision]);

  return (
    <div className={styles.sectionStack}>
      <Card className={styles.panel}>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="history.title" />
        </h2>
        {result && result.action === 'restore' && (
          <ActionResultNotice result={result} authoring={authoring} />
        )}
        {revisions === null ? (
          <p className={styles.muted}>
            <FormattedMessage id="history.loading" />
          </p>
        ) : (
          <ul className={styles.list} data-testid="revisions">
            {revisions.map((revision) => {
              const current = revision.number === draft.currentRevision;
              return (
                <li key={revision.number} className={styles.listItem}>
                  <div className={styles.listRow}>
                    <strong>
                      <FormattedMessage id="history.item" values={{ number: revision.number }} />
                    </strong>
                    <span className={styles.muted} data-testid={`provenance-${revision.number}`}>
                      <Provenance revision={revision} />
                    </span>
                    <span className={styles.muted}>
                      <FormattedMessage id="history.files" values={{ count: revision.files }} />
                    </span>
                    <span className={styles.muted}>
                      {intl.formatDate(revision.createdAt, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    {current && (
                      <span className={`${styles.badge} ${styles.badgeOk}`}>
                        <FormattedMessage id="history.current" />
                      </span>
                    )}
                  </div>
                  <div className={styles.listRow}>
                    <Button
                      size="md"
                      variant="ghost"
                      onClick={() => void authoring.compare(revision.parent ?? 0, revision.number)}
                      data-testid={`changes-${revision.number}`}
                    >
                      <FormattedMessage id="history.showChanges" />
                    </Button>
                    {!current && (
                      <>
                        <Button
                          size="md"
                          variant="ghost"
                          onClick={() => void authoring.compare(revision.number, null)}
                          data-testid={`compare-${revision.number}`}
                        >
                          <FormattedMessage id="history.compareCurrent" />
                        </Button>
                        <Button
                          size="md"
                          variant="secondary"
                          disabled={busy !== null}
                          loading={busy === 'restore'}
                          onClick={() => void authoring.restore(revision.number)}
                          data-testid={`restore-${revision.number}`}
                        >
                          <FormattedMessage id="history.restore" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {revisions !== null && olderRevisions && (
          <Button
            size="md"
            variant="secondary"
            onClick={() => void authoring.loadOlderRevisions()}
            data-testid="older-revisions"
          >
            <FormattedMessage id="history.older" />
          </Button>
        )}
      </Card>
      {comparison && (
        <ComparisonCard
          comparison={comparison}
          current={draft.currentRevision}
          authoring={authoring}
        />
      )}
    </div>
  );
}

// Where a revision came from, in words: what made it, from where, and what it restored or was
// copied from.
function Provenance({ revision }: { revision: DraftRevision }) {
  return (
    <span className={styles.provenance}>
      <span>
        <FormattedMessage id="history.kind" values={{ kind: revision.kind }} />
      </span>
      {revision.origin !== null && (
        <span>
          <FormattedMessage id="history.origin" values={{ origin: revision.origin }} />
        </span>
      )}
      {revision.restoredFrom !== null && (
        <span>
          <FormattedMessage id="history.restoredFrom" values={{ number: revision.restoredFrom }} />
        </span>
      )}
      {revision.from !== null && (
        <span>
          <FormattedMessage
            id={revision.kind === 'edition' ? 'history.editionFrom' : 'history.templateFrom'}
          />
        </span>
      )}
    </span>
  );
}

function ComparisonCard({
  comparison,
  current,
  authoring,
}: {
  comparison: RevisionComparison;
  current: number;
  authoring: GameAuthoring;
}) {
  const to = comparison.to ?? current;
  return (
    <Card className={styles.panel} data-testid="comparison">
      <h2 className={styles.sectionTitle}>
        {comparison.from === 0 ? (
          <FormattedMessage id="diff.titleFromEmpty" values={{ to }} />
        ) : (
          <FormattedMessage id="diff.title" values={{ from: comparison.from, to }} />
        )}
      </h2>
      {comparison.path !== null && (
        <p className={styles.muted}>
          <code>{comparison.path}</code>
        </p>
      )}
      {comparison.status === 'loading' && (
        <p className={styles.muted}>
          <FormattedMessage id="diff.loading" />
        </p>
      )}
      {comparison.status === 'failed' && (
        <p className={styles.errorText} role="alert">
          <FormattedMessage id="diff.failed" />
        </p>
      )}
      {comparison.diff && comparison.diff.files.length === 0 && (
        <p className={styles.muted}>
          <FormattedMessage id="diff.empty" />
        </p>
      )}
      {comparison.diff?.files.map((file) => (
        <div key={file.path} className={styles.summaryLine} data-testid="diff-file">
          <div className={styles.listRow}>
            <code>{file.path}</code>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
              <FormattedMessage id="diff.status" values={{ status: file.status }} />
            </span>
          </div>
          {/* The diff is the backend's text, shown as it came (user-facing-text.md, allowed
              exceptions). */}
          {file.diff !== null && <pre className={styles.diff}>{file.diff}</pre>}
          {file.truncated && (
            <span className={styles.muted}>
              <FormattedMessage id="diff.truncated" />
            </span>
          )}
          {file.omitted && (
            <div className={styles.listRow}>
              <span className={styles.muted}>
                <FormattedMessage id="diff.omitted" />
              </span>
              <Button
                size="md"
                variant="ghost"
                onClick={() => void authoring.compare(comparison.from, comparison.to, file.path)}
              >
                <FormattedMessage id="diff.showFile" />
              </Button>
            </div>
          )}
        </div>
      ))}
      <div className={styles.noticeActions}>
        <Button size="md" variant="ghost" onClick={authoring.closeComparison}>
          <FormattedMessage id="diff.close" />
        </Button>
      </div>
    </Card>
  );
}
