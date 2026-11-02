import { createGameAuthoring, type GameAuthoring } from '@playhoot/feature-game-authoring';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { AppShell, Button, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { BuildStatusBadge } from './BuildStatusBadge';
import styles from './GameWorkspace.module.css';
import { AiChangesSection } from './sections/AiChangesSection';
import { AssetsSection } from './sections/AssetsSection';
import { BuildSection } from './sections/BuildSection';
import { FilesSection } from './sections/FilesSection';
import { HistorySection } from './sections/HistorySection';
import { ScenariosSection } from './sections/ScenariosSection';
import { ShareSection } from './sections/ShareSection';

// The workspace's sections, by the stable ids the agent guide uses (`?section=`), in order.
export const workspaceSections = [
  'ai',
  'files',
  'assets',
  'build',
  'scenarios',
  'history',
  'share',
] as const;
export type WorkspaceSection = (typeof workspaceSections)[number];

const sectionLabels: Record<WorkspaceSection, MessageId> = {
  ai: 'section.ai',
  files: 'section.files',
  assets: 'section.assets',
  build: 'section.build',
  scenarios: 'section.scenarios',
  history: 'section.history',
  share: 'section.share',
};

// `/games/:gameUUID/edit?section=…`: a creator's workspace for their game's draft (game-creation
// CHECKLIST B). Everything is read again from the backend when the route opens.
export function GameWorkspaceRoute() {
  return (
    <RequireOperation operation={operations.editGame}>
      <Workspace />
    </RequireOperation>
  );
}

function useGameAuthoring(gameUUID: string): GameAuthoring | null {
  const services = useServices();
  const [authoring, setAuthoring] = useState<GameAuthoring | null>(null);
  useEffect(() => {
    const next = createGameAuthoring({ games: services.gamesApi, gameUUID });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setAuthoring(next);
    void next.reload();
    return () => next.dispose();
  }, [gameUUID, services]);
  return authoring;
}

function Workspace() {
  const { gameUUID = '' } = useParams();
  const authoring = useGameAuthoring(gameUUID);
  if (!authoring) return <AppShell>{null}</AppShell>;
  return <WorkspaceScreen authoring={authoring} />;
}

function WorkspaceScreen({ authoring }: { authoring: GameAuthoring }) {
  const intl = useIntl();
  const layout = useLayout();
  const [search, setSearch] = useSearchParams();
  const load = useStore(authoring.store, (state) => state.load);
  const draft = useStore(authoring.store, (state) => state.draft);
  const asked = search.get('section');
  const section: WorkspaceSection = (workspaceSections as readonly string[]).includes(asked ?? '')
    ? (asked as WorkspaceSection)
    : 'ai';

  if (load.status !== 'ready' || !draft) {
    const failed = load.status === 'failed';
    return (
      <AppShell>
        <Stage>
          <div className={styles.hero}>
            <Owl size={112} animated={!failed} mood={failed ? 'sleepy' : 'happy'} />
            <h1 className={styles.heroTitle}>
              {load.status === 'failed' ? (
                <FormattedMessage
                  id={
                    load.reason === 'not-found'
                      ? 'workspace.error.notFound'
                      : load.reason === 'not-editable'
                        ? 'workspace.error.notEditable'
                        : 'workspace.error.unavailable'
                  }
                />
              ) : (
                <FormattedMessage id="workspace.loading" />
              )}
            </h1>
          </div>
          {failed && (
            <Button size="lg" block onClick={() => void authoring.reload()}>
              <FormattedMessage id="workspace.retry" />
            </Button>
          )}
        </Stage>
      </AppShell>
    );
  }

  const open = (next: WorkspaceSection) =>
    setSearch(next === 'ai' ? {} : { section: next }, { replace: true });

  const nav = (
    <nav
      className={layout === 'wide' ? styles.navWide : styles.navCompact}
      aria-label={intl.formatMessage({ id: 'workspace.sections' })}
    >
      {workspaceSections.map((id) => (
        <button
          key={id}
          type="button"
          data-section={id}
          className={[styles.navItem, id === section && styles.navItemActive]
            .filter(Boolean)
            .join(' ')}
          aria-current={id === section ? 'page' : undefined}
          onClick={() => open(id)}
        >
          <FormattedMessage id={sectionLabels[id]} />
        </button>
      ))}
    </nav>
  );

  return (
    <AppShell>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <FormattedMessage id="workspace.title" />
          </h1>
          <span className={styles.revisionChip} data-testid="current-revision">
            <FormattedMessage
              id="workspace.revision"
              values={{ revision: draft.currentRevision }}
            />
          </span>
          <BuildStatusBadge status={draft.build?.status ?? null} />
        </header>
        <div className={layout === 'wide' ? styles.bodyWide : styles.bodyCompact}>
          {nav}
          <div className={styles.content}>
            {section === 'ai' && <AiChangesSection authoring={authoring} />}
            {section === 'files' && <FilesSection authoring={authoring} />}
            {section === 'assets' && <AssetsSection authoring={authoring} />}
            {section === 'build' && <BuildSection authoring={authoring} />}
            {section === 'scenarios' && (
              <ScenariosSection authoring={authoring} onOpenBuild={() => open('build')} />
            )}
            {section === 'history' && <HistorySection authoring={authoring} />}
            {section === 'share' && <ShareSection gameUUID={draft.gameUUID} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
