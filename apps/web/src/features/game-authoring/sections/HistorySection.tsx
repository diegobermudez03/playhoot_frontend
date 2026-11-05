import type { GameAuthoring } from '@playhoot/feature-game-authoring';
import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { Button, Card } from '../../../ui';
import { ActionResultNotice } from '../ActionResultNotice';
import styles from '../GameWorkspace.module.css';

// "Historial": every revision, newest first, with where it came from; restoring one makes a new
// revision with its files and assets.
export function HistorySection({ authoring }: { authoring: GameAuthoring }) {
  const intl = useIntl();
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const revisions = useStore(authoring.store, (state) => state.revisions);
  const olderRevisions = useStore(authoring.store, (state) => state.olderRevisions);
  const busy = useStore(authoring.store, (state) => state.busy);
  const result = useStore(authoring.store, (state) => state.result);

  useEffect(() => {
    void authoring.loadRevisions();
  }, [authoring, draft.currentRevision]);

  return (
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
                  <span className={styles.muted}>
                    <FormattedMessage id="history.source" values={{ source: revision.source }} />
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
                  {current ? (
                    <span className={`${styles.badge} ${styles.badgeOk}`}>
                      <FormattedMessage id="history.current" />
                    </span>
                  ) : (
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
  );
}
