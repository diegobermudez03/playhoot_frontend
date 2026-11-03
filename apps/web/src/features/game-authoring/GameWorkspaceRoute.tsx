import {
  createGameAuthoring,
  createGamePreview,
  createGamePublishing,
  type GameAuthoring,
  type GamePreview,
  type GamePublishing,
} from '@playhoot/feature-game-authoring';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams, useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { AppShell, Button, Card, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { BuildStatusBadge } from './BuildStatusBadge';
import styles from './GameWorkspace.module.css';
import { AiChangesSection } from './sections/AiChangesSection';
import { AssetsSection } from './sections/AssetsSection';
import { BuildSection } from './sections/BuildSection';
import { FilesSection } from './sections/FilesSection';
import { HistorySection } from './sections/HistorySection';
import { PreviewSection } from './sections/PreviewSection';
import { PublishSection } from './sections/PublishSection';
import { ScenariosSection } from './sections/ScenariosSection';
import { ShareSection } from './sections/ShareSection';

// The workspace's sections, by the stable ids the agent guide uses (`?section=`), in order.
export const workspaceSections = [
  'ai',
  'files',
  'assets',
  'build',
  'preview',
  'scenarios',
  'history',
  'share',
  'publish',
] as const;
export type WorkspaceSection = (typeof workspaceSections)[number];

const sectionLabels: Record<WorkspaceSection, MessageId> = {
  ai: 'section.ai',
  files: 'section.files',
  assets: 'section.assets',
  build: 'section.build',
  preview: 'section.preview',
  scenarios: 'section.scenarios',
  history: 'section.history',
  share: 'section.share',
  publish: 'section.publish',
};

// Sections that read or change the open edition's draft; without one they explain how to open it.
const draftSections: readonly WorkspaceSection[] = [
  'ai',
  'files',
  'assets',
  'build',
  'preview',
  'scenarios',
  'history',
];

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

// The game's preview lives as long as the workspace, not the section: the creator can leave
// "Probar juego" to change the draft and come back to the same running test.
function useGamePreview(gameUUID: string): GamePreview | null {
  const services = useServices();
  const [preview, setPreview] = useState<GamePreview | null>(null);
  useEffect(() => {
    const next = createGamePreview(gameUUID, {
      games: services.gamesApi,
      previews: services.previews,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setPreview(next);
    return () => next.dispose();
  }, [gameUUID, services]);
  return preview;
}

// The game's card and publication, read when the workspace opens and after each action.
function useGamePublishing(gameUUID: string): GamePublishing | null {
  const services = useServices();
  const [publishing, setPublishing] = useState<GamePublishing | null>(null);
  useEffect(() => {
    const next = createGamePublishing({ games: services.gamesApi, gameUUID });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setPublishing(next);
    void next.load();
    return () => next.dispose();
  }, [gameUUID, services]);
  return publishing;
}

function Workspace() {
  const { gameUUID = '' } = useParams();
  const authoring = useGameAuthoring(gameUUID);
  const preview = useGamePreview(gameUUID);
  const publishing = useGamePublishing(gameUUID);
  if (!authoring || !preview || !publishing) return <AppShell>{null}</AppShell>;
  return (
    <WorkspaceScreen
      gameUUID={gameUUID}
      authoring={authoring}
      preview={preview}
      publishing={publishing}
    />
  );
}

function WorkspaceScreen({
  gameUUID,
  authoring,
  preview,
  publishing,
}: {
  gameUUID: string;
  authoring: GameAuthoring;
  preview: GamePreview;
  publishing: GamePublishing;
}) {
  const intl = useIntl();
  const layout = useLayout();
  const [search, setSearch] = useSearchParams();
  const load = useStore(authoring.store, (state) => state.load);
  const draft = useStore(authoring.store, (state) => state.draft);
  const asked = search.get('section');
  // A published game without an open edition has no draft: the workspace still opens, on its card.
  const noEdition = load.status === 'failed' && load.reason === 'not-editable';
  const section: WorkspaceSection = (workspaceSections as readonly string[]).includes(asked ?? '')
    ? (asked as WorkspaceSection)
    : noEdition
      ? 'publish'
      : 'ai';

  if (!noEdition && (load.status !== 'ready' || !draft)) {
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
    setSearch(next === 'ai' && !noEdition ? {} : { section: next }, { replace: true });
  const reloadAll = () => {
    void authoring.reload();
    void publishing.load();
  };

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
          {draft && !noEdition ? (
            <>
              <span className={styles.revisionChip} data-testid="current-revision">
                <FormattedMessage
                  id="workspace.revision"
                  values={{ revision: draft.currentRevision }}
                />
              </span>
              <BuildStatusBadge status={draft.build?.status ?? null} />
            </>
          ) : (
            <span className={styles.revisionChip} data-testid="published-chip">
              <FormattedMessage id="workspace.published" />
            </span>
          )}
        </header>
        <div className={layout === 'wide' ? styles.bodyWide : styles.bodyCompact}>
          {nav}
          <div className={styles.content}>
            {noEdition && draftSections.includes(section) && (
              <PublishedNotice onOpenPublish={() => open('publish')} />
            )}
            {!noEdition && (
              <DraftSections
                section={section}
                authoring={authoring}
                preview={preview}
                open={open}
              />
            )}
            {section === 'publish' && (
              <PublishSection
                publishing={publishing}
                draft={noEdition ? null : draft}
                onOpenSection={open}
                onEditionOpened={reloadAll}
                onPublished={reloadAll}
              />
            )}
            {section === 'share' && <ShareSection gameUUID={gameUUID} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// What a draft section shows while the game is published without an open edition.
function PublishedNotice({ onOpenPublish }: { onOpenPublish: () => void }) {
  return (
    <Card className={styles.panel} data-testid="published-notice">
      <p>
        <FormattedMessage id="workspace.publishedNotice" />
      </p>
      <div className={styles.rowActions}>
        <Button onClick={onOpenPublish}>
          <FormattedMessage id="workspace.openPublish" />
        </Button>
      </div>
    </Card>
  );
}

function DraftSections({
  section,
  authoring,
  preview,
  open,
}: {
  section: WorkspaceSection;
  authoring: GameAuthoring;
  preview: GamePreview;
  open: (section: WorkspaceSection) => void;
}) {
  return (
    <>
      {section === 'ai' && <AiChangesSection authoring={authoring} />}
      {section === 'files' && <FilesSection authoring={authoring} />}
      {section === 'assets' && <AssetsSection authoring={authoring} />}
      {section === 'build' && <BuildSection authoring={authoring} />}
      {section === 'preview' && (
        <PreviewSection authoring={authoring} preview={preview} onOpenBuild={() => open('build')} />
      )}
      {section === 'scenarios' && (
        <ScenariosSection authoring={authoring} onOpenBuild={() => open('build')} />
      )}
      {section === 'history' && <HistorySection authoring={authoring} />}
    </>
  );
}
