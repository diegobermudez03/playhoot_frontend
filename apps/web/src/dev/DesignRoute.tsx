import type { JoinSessionState, JoinView } from '@playhoot/feature-session-join';
import type { GameHostStatus } from '@playhoot/game-host';
import { joinCodeAlphabet } from '@playhoot/protocol';
import { useState, type ReactNode } from 'react';

import { SessionScreen } from '../features/session-join/SessionScreen';
import { PlayScreen, type RosterPlayer } from '../features/session-play/PlayScreen';
import { silentSoundPlayer, SoundProvider, useSound, type SoundId } from '../sound';
import { AppShell, Avatar, Button, Card, CodeInput, CodeTiles, Logo, Owl, TextField } from '../ui';
import styles from './DesignRoute.module.css';

// Development-only living style guide: tokens, components and every Join Session screen with
// fake state, for reviewing the design without a backend.
export function DesignRoute() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>Playhoot design proposal</h1>
          <p>
            Living style guide (dev only). Rationale and open questions:
            docs/design/DESIGN_SYSTEM.md
          </p>
        </header>
        <Section title="Identity">
          <div className={styles.row}>
            <Logo size="lg" />
            <Owl size={96} />
            <Owl size={96} mood="surprised" />
            <Owl size={96} mood="sleepy" />
            <Owl size={96} animated />
          </div>
        </Section>
        <Section title="Color">
          <Swatches
            names={[
              'night-950',
              'night-900',
              'night-800',
              'night-700',
              'night-600',
              'amber-400',
              'coral-400',
              'mint-400',
              'sky-400',
              'violet-400',
              'red-400',
              'star-50',
            ]}
          />
          <p className={styles.caption}>Player colors, in seat order</p>
          <div className={styles.row}>
            {Array.from({ length: 8 }, (_, i) => (
              <Avatar key={i} seat={i + 1} label={'ABCDEFGH'[i]!} size="lg" />
            ))}
          </div>
        </Section>
        <Section title="Type">
          <p style={{ font: '600 var(--text-display)/1.1 var(--font-display)' }}>
            Display · Fredoka
          </p>
          <h2 style={{ fontSize: 'var(--text-2xl)' }}>Heading · Fredoka</h2>
          <p>Body · Nunito. Quick, friendly and very readable on small screens.</p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Muted body text for secondary information.
          </p>
        </Section>
        <Section title="Controls">
          <div className={styles.row}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className={styles.fields}>
            <TextField
              label="Your name"
              placeholder="e.g. Night Owl"
              hint="Shown to other players."
            />
            <TextField label="With an error" defaultValue="" error="Use 1 to 64 characters." />
          </div>
          <div className={styles.row}>
            <CodeTiles code="HOOT42" size="lg" />
          </div>
          <CodeInputDemo />
        </Section>
        <Section title="Sounds">
          <p className={styles.caption}>
            Missing files play placeholder tones · docs/design/ASSETS.md
          </p>
          <SoundBoard />
        </Section>
        <Section title="Join Session screens">
          <p className={styles.caption}>Silent here; each screen plays its sounds in the app</p>
          <SoundProvider player={silentSoundPlayer}>
            {screens.map(([label, view, joinCode]) => (
              <Frame key={label} label={label}>
                <SessionScreen
                  state={fakeState(view)}
                  joinCode={joinCode}
                  displayName="Night Owl"
                  actions={noActions}
                />
              </Frame>
            ))}
          </SoundProvider>
        </Section>
        <Section title="Session Play screens">
          <p className={styles.caption}>
            The game itself runs in the dark area (see /dev/game-host)
          </p>
          <SoundProvider player={silentSoundPlayer}>
            {playScreens.map(([label, game, reconnecting, rosterOpen]) => (
              <Frame key={label} label={label}>
                <div className={styles.playFrame}>
                  <PlayScreen
                    seat={2}
                    total={4}
                    displayName="Night Owl"
                    players={fakeRoster}
                    initialRosterOpen={rosterOpen}
                    game={game}
                    reconnecting={reconnecting}
                    onRetry={() => undefined}
                    onLeave={() => undefined}
                  />
                </div>
              </Frame>
            ))}
          </SoundProvider>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </Card>
  );
}

function Swatches({ names }: { names: string[] }) {
  return (
    <div className={styles.swatches}>
      {names.map((name) => (
        <div key={name} className={styles.swatch}>
          <span className={styles.chip} style={{ background: `var(--${name})` }} />
          <code>{name}</code>
        </div>
      ))}
    </div>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div className={styles.frameBody}>{children}</div>
    </figure>
  );
}

const soundIds: SoundId[] = [
  'tap',
  'key',
  'erase',
  'copy',
  'join',
  'player-joined',
  'player-left',
  'game-start',
  'error',
  'ended',
  'leave',
];

function SoundBoard() {
  const sound = useSound();
  const [music, setMusic] = useState(false);
  return (
    <div className={styles.row}>
      {soundIds.map((id) => (
        <Button key={id} variant="secondary" sound={id}>
          {id}
        </Button>
      ))}
      <Button
        variant={music ? 'danger' : 'secondary'}
        sound={null}
        onClick={() => {
          if (music) sound.stopMusic();
          else sound.startMusic('lobby');
          setMusic(!music);
        }}
      >
        {music ? 'stop lobby music' : 'lobby music'}
      </Button>
    </div>
  );
}

function CodeInputDemo() {
  const [code, setCode] = useState('HO');
  return (
    <CodeInput
      value={code}
      onChange={setCode}
      length={6}
      alphabet={joinCodeAlphabet}
      label="Demo code"
    />
  );
}

const me = 'me';
const members = [
  { userUUID: 'a', displayName: 'Ana', isYou: false },
  { userUUID: me, displayName: 'Guest', isYou: true },
  { userUUID: 'b', displayName: 'Bruno', isYou: false },
  { userUUID: 'c', displayName: '', isYou: false },
];

const screens: [string, JoinView, string | null][] = [
  ['Name', { phase: 'identity', submitting: false, error: null }, 'HOOT42'],
  [
    'Name · error',
    { phase: 'identity', submitting: false, error: { kind: 'unavailable' } },
    'HOOT42',
  ],
  ['Joining', { phase: 'connecting', reconnectAttempt: 0 }, 'HOOT42'],
  ['Reconnecting', { phase: 'connecting', reconnectAttempt: 2 }, null],
  ['Lobby', { phase: 'lobby', members }, 'HOOT42'],
  ['Lobby · joined by link', { phase: 'lobby', members: members.slice(1, 2) }, null],
  [
    'Game starting',
    {
      phase: 'started',
      session: {
        participantId: 'P2',
        participants: members.map((m, i) => ({
          participantId: `P${i + 1}`,
          userUUID: m.userUUID,
          displayName: m.displayName,
          isYou: m.isYou,
          status: 'active',
        })),
        frontend: { url: '', sha256: '', expiresAt: '' },
      },
      connection: 'connected',
    },
    null,
  ],
  ['Code not found', { phase: 'closed', outcome: { kind: 'unreachable' } }, null],
  ['Game full', { phase: 'closed', outcome: { kind: 'rejected', reason: 'lobby_full' } }, null],
  [
    'Already started',
    { phase: 'closed', outcome: { kind: 'rejected', reason: 'session_started' } },
    null,
  ],
  [
    'Lobby expired',
    {
      phase: 'closed',
      outcome: { kind: 'ended', status: 'EXPIRED', endCause: 'LOBBY_EXPIRED', beforeStart: true },
    },
    null,
  ],
  ['Opened elsewhere', { phase: 'closed', outcome: { kind: 'replaced' } }, null],
  ['Connection lost', { phase: 'closed', outcome: { kind: 'connection-lost' } }, null],
];

const playScreens: [string, GameHostStatus, boolean, boolean][] = [
  ['Loading the game', { phase: 'starting' }, false, false],
  ['Playing', { phase: 'running', version: 1 }, false, false],
  ['Playing · players list open', { phase: 'running', version: 1 }, false, true],
  ['Playing · reconnecting', { phase: 'running', version: 1 }, true, false],
  [
    'Game failed · unreachable',
    { phase: 'failed', error: { kind: 'artifact-unreachable', detail: '' } },
    false,
    false,
  ],
  ['Game failed · broken', { phase: 'failed', error: { kind: 'ready-timeout' } }, false, false],
];

const fakeRoster: RosterPlayer[] = [
  { seat: 1, name: 'Ana', hasName: true, isYou: false, status: 'active' },
  { seat: 2, name: 'Night Owl', hasName: true, isYou: true, status: 'active' },
  { seat: 3, name: 'Bruno', hasName: true, isYou: false, status: 'reconnecting' },
  { seat: 4, name: 'Carla', hasName: true, isYou: false, status: 'left' },
];

function fakeState(view: JoinView): JoinSessionState {
  return { target: { kind: 'joinCode', joinCode: 'HOOT42' }, sessionUUID: null, view };
}

const noActions = {
  submitDisplayName: () => undefined,
  retry: () => undefined,
  leave: () => undefined,
  enterAnotherCode: () => undefined,
  copyInvite: async () => true,
};
