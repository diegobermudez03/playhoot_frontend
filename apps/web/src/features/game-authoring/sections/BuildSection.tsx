import type { GameAuthoring } from '@playhoot/feature-game-authoring';
import { infrastructureStage } from '@playhoot/protocol';
import { FormattedMessage } from 'react-intl';
import { useStore } from 'zustand';

import { Card } from '../../../ui';
import { BuildStatusBadge } from '../BuildStatusBadge';
import { DiagnosticList } from '../DiagnosticList';
import styles from '../GameWorkspace.module.css';

// "Construcción": the current revision's build with what it found, file by file and line by
// line, and the last revision that built.
export function BuildSection({ authoring }: { authoring: GameAuthoring }) {
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const build = draft.build;
  const lastGood = draft.lastSuccessfulBuild;
  const platformFailure = build?.diagnostics.some((d) => d.stage === infrastructureStage) ?? false;

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="build.title" values={{ revision: draft.currentRevision }} />
      </h2>
      <div className={styles.listRow}>
        <BuildStatusBadge status={build?.status ?? null} />
        {build?.reused && (
          <span className={styles.muted}>
            <FormattedMessage id="build.reused" />
          </span>
        )}
      </div>
      {!build && (
        <p className={styles.muted}>
          <FormattedMessage id="build.none" />
        </p>
      )}
      {platformFailure && (
        <p className={styles.warningText}>
          <FormattedMessage id="build.infrastructure" />
        </p>
      )}
      {build && build.diagnostics.length > 0 && (
        <>
          <h3 className={styles.subTitle}>
            <FormattedMessage id="build.diagnostics" />
          </h3>
          <div data-testid="build-diagnostics">
            <DiagnosticList
              items={build.diagnostics.map((diagnostic) => ({
                where: diagnostic.file
                  ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''}${diagnostic.column ? `:${diagnostic.column}` : ''}`
                  : '',
                code: diagnostic.code
                  ? `${diagnostic.stage} · ${diagnostic.code}`
                  : diagnostic.stage,
                message: diagnostic.message,
              }))}
            />
          </div>
        </>
      )}
      <p className={styles.muted}>
        {lastGood ? (
          <FormattedMessage id="build.lastSuccessful" values={{ revision: lastGood.revision }} />
        ) : (
          <FormattedMessage id="build.lastSuccessfulNone" />
        )}
      </p>
    </Card>
  );
}
