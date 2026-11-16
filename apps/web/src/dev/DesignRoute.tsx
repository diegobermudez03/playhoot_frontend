import type { JoinSessionState, JoinView } from '@playhoot/feature-session-join';
import type { GameHostStatus } from '@playhoot/game-host';
import { joinCodeAlphabet } from '@playhoot/protocol';
import { useState, type ReactNode } from 'react';

import { ModeChoice } from '../app/shell/ModeChoice';
import { HomeScreen } from '../features/home/HomeScreen';
import { useLayout, type Layout } from '../features/layout';
import { SessionScreen } from '../features/session-join/SessionScreen';
import { PlayScreen, type RosterPlayer } from '../features/session-play/PlayScreen';
import { silentSoundPlayer, SoundProvider, useSound, type SoundId } from '../sound';
import {
  Avatar,
  Button,
  Card,
  CodeInput,
  CodeTiles,
  Dialog,
  EmptyState,
  Logo,
  Mascot,
  ModeSwitch,
  PageHeading,
  Pill,
  Select,
  Skeleton,
  Status,
  StatusArea,
  Tag,
  TextField,
} from '../ui';
import styles from './DesignRoute.module.css';

/*
 * The component gallery (development only, `/design`).
 *
 * This is the review surface for the design system T-203 built from the chosen
 * visual direction, "Ink & Sticker" (C-03): every core component in its states,
 * in both orientations, then the implemented screens with fake state. A later
 * task that adds a core component adds it here too — this page is how the
 * creator and the next session see what exists without a backend.
 */
export function DesignRoute() {
  const detected = useLayout();
  const [layout, setLayout] = useState<Layout>(detected);
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <PageHeading
          kicker="Development only"
          title="Playhoot design system"
          lead="Ink & Sticker (C-03): warm paper, near-black ink, flat accent fills, 2 px outlines and hard offset shadows. Tokens in src/ui/tokens/, rationale in docs/design/DESIGN_SYSTEM.md."
        />
        <div className={styles.row}>
          <ModeSwitch
            label="Screens layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'compact', label: 'compact' },
              { value: 'wide', label: 'wide' },
            ]}
          />
          <span className={styles.caption}>this display: {detected}</span>
        </div>
      </header>

      <Section title="Identity">
        <div className={styles.row}>
          <Logo size="lg" />
          <Mascot size={120} />
          <Mascot size={120} mood="surprised" />
          <Mascot size={120} mood="sleepy" />
          <Mascot size={120} animated />
        </div>
        <p className={styles.note}>
          The mascot is a slot, not a picture (P24§3): head, eyes, tail and bounce are separate
          parts driven by the motion tokens. The cat inside it is the placeholder of the direction
          render, registered as the pending asset mascot.primary; the final character replaces what
          the slot draws, and no screen changes.
        </p>
      </Section>

      <Section title="Colour">
        <p className={styles.caption}>Surfaces and ink</p>
        <Swatches
          names={[
            'color-page',
            'color-surface',
            'color-surface-sunken',
            'color-surface-raised',
            'color-surface-muted',
            'color-text',
            'color-text-muted',
            'color-text-subtle',
          ]}
        />
        <p className={styles.caption}>Roles</p>
        <Swatches
          names={[
            'color-primary',
            'color-accent',
            'color-highlight',
            'color-info',
            'color-success',
            'color-success-text',
            'color-danger-text',
            'color-outline',
          ]}
        />
        <p className={styles.caption}>Player colours, in seat order</p>
        <div className={styles.row}>
          {Array.from({ length: 8 }, (_, i) => (
            <Avatar key={i} seat={i + 1} label={'ABCDEFGH'[i]!} size="lg" />
          ))}
        </div>
        <p className={styles.note}>
          Every control is bound by the ink outline, so a component boundary never depends on its
          fill: ink is at least 4.85:1 against any fill and 12.6:1 against any surface. The measured
          pairs are recorded in the T-203 result.
        </p>
      </Section>

      <Section title="Type">
        <p className={styles.caption}>Display · Fredoka · headings and numbers</p>
        <h2>Make the whole room play.</h2>
        <p className={styles.caption}>Body · Nunito · everything else</p>
        <p>Body text at the default weight. Quick, friendly and very readable on small screens.</p>
        <p className={styles.muted}>Muted body text for secondary information.</p>
        <p className={styles.subtle}>Subtle text for hints and captions.</p>
      </Section>

      <Section title="Buttons">
        <Orientations>
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className={styles.row}>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className={styles.row}>
              <Button loading>Working</Button>
              <Button disabled>Disabled</Button>
            </div>
            <Button block size="lg">
              Block
            </Button>
          </div>
        </Orientations>
        <p className={styles.note}>
          Press and hold one: the sticker slides into its own shadow. Tab to it: the ink ring with a
          paper gap is the single focus indicator of the whole system.
        </p>
      </Section>

      <Section title="Form controls">
        <Orientations>
          <div className={styles.fields}>
            <TextField
              label="Your name"
              placeholder="e.g. Paper Cat"
              hint="Shown to other players."
            />
            <TextField label="With an error" defaultValue="" error="Use 1 to 64 characters." />
            <TextField label="Not available" defaultValue="Fixed" disabled />
            <Select label="Language" defaultValue="en">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </Select>
          </div>
        </Orientations>
        <p className={styles.caption}>Code input (join code, second factor)</p>
        <CodeInputDemo />
        <p className={styles.caption}>Code input with its label drawn (the home page)</p>
        <CodeInputDemo labelVisible />
        <div className={styles.row}>
          <CodeTiles code="HOOT42" size="md" />
        </div>
      </Section>

      <Section title="Containers">
        <Orientations>
          <div className={styles.stack}>
            <Card>A card: white paper, ink outline, hard shadow.</Card>
            <Card tone="flat">Flat: lying on the board, for a card inside a card.</Card>
            <Card tone="accent">Accent: the one card on a screen that carries the message.</Card>
            <Card tone="highlight" tilted>
              Highlight, stuck down slightly askew.
            </Card>
          </div>
        </Orientations>
      </Section>

      <Section title="Status, tags and pills">
        <Orientations>
          <div className={styles.stack}>
            <Status>Nothing special happened.</Status>
            <Status tone="info">The invitation link was copied.</Status>
            <Status tone="success">Everyone is in.</Status>
            <Status tone="warning">Two players have not answered.</Status>
            <Status tone="danger">The session could not be reached.</Status>
            <div className={styles.row}>
              <Tag>Geography</Tag>
              <Tag tone="info">2–50 players</Tag>
              <Tag tone="accent">Grades</Tag>
              <Tag tone="highlight" onRemove={() => undefined} removeLabel="Remove Math">
                Math
              </Tag>
            </div>
            <div className={styles.row}>
              <Pill>Waiting</Pill>
              <Pill tone="success">Live</Pill>
              <Pill tone="danger">Blocked</Pill>
              <Pill tone="info">Draft</Pill>
            </div>
            <StatusArea>
              <Status tone="success">A live region: it holds its space when empty.</Status>
            </StatusArea>
          </div>
        </Orientations>
        <p className={styles.note}>
          Every tone carries a mark as well as a fill, so none of them depends on colour alone.
        </p>
      </Section>

      <Section title="Loading and emptiness">
        <Orientations>
          <div className={styles.stack}>
            <Skeleton shape="text" width="12rem" />
            <Skeleton shape="text" width="18rem" />
            <Skeleton shape="block" />
            <div className={styles.row}>
              <Skeleton shape="circle" width="44px" />
              <Skeleton shape="circle" width="44px" />
              <Skeleton shape="circle" width="44px" />
            </div>
            <EmptyState
              title="No games yet"
              body="The games you create appear here. Make the first one and it is ready to play in a couple of minutes."
              actions={<Button>Create a game</Button>}
            />
          </div>
        </Orientations>
      </Section>

      <Section title="Dialog">
        <DialogDemo />
        <p className={styles.note}>
          Built on the native dialog element: the browser traps focus inside it, closes it on Escape
          and returns focus to the button that opened it.
        </p>
      </Section>

      <Section title="Avatars and headings">
        <div className={styles.row}>
          <Avatar seat={1} label="Ana" size="sm" />
          <Avatar seat={2} label="Bruno" />
          <Avatar seat={3} label="Carla" size="lg" />
          <Avatar seat={4} label="Dani" highlighted />
        </div>
        <PageHeading
          level={2}
          kicker="For teachers"
          title="Your classes"
          lead="Create a class, invite your students and give them an activity."
          actions={
            <>
              <Button variant="secondary">Import</Button>
              <Button>New class</Button>
            </>
          }
        />
      </Section>

      <Section title="Sounds">
        <p className={styles.caption}>
          Missing files play placeholder tones · docs/design/ASSETS.md
        </p>
        <SoundBoard />
      </Section>

      <Section title="The shell">
        <p className={styles.note}>
          The top bar of this very page is the shell: it is rendered once above the router
          (root.tsx), so moving between screens never rebuilds it. A screen only says how it wants
          to be framed (useShellMode): the whole bar, the bar without the logo, or none at all while
          a game takes the display. Below 760 px the join and create entries, the language and the
          sound move into the bar's menu, and below 420 px so does the mode switch.
        </p>
        <div className={styles.row}>
          <ModeChoice />
        </div>
        <p className={styles.caption}>
          The three modes of the specification. Only the normal one exists; the other two explain
          what they will be and leave the person where they are.
        </p>
      </Section>

      <Section title="Home">
        <p className={styles.caption}>
          The public entry, in both implementations. Server-rendered: no account, no services.
        </p>
        <Frame label="vertical">
          <HomeScreen layout="compact" />
        </Frame>
        <Frame label="horizontal">
          <HomeScreen layout="wide" />
        </Frame>
      </Section>

      <Section title="Join Session screens">
        <p className={styles.caption}>Silent here; each screen plays its sounds in the app</p>
        <SoundProvider player={silentSoundPlayer}>
          {screens.map(([label, view, joinCode]) => (
            <Frame key={label} label={label}>
              <SessionScreen
                layout={layout}
                state={fakeState(view)}
                joinCode={joinCode}
                displayName="Paper Cat"
                actions={noActions}
              />
            </Frame>
          ))}
        </SoundProvider>
      </Section>
      <Section title="Session Play screens">
        <p className={styles.caption}>The game itself runs in the dark area (see /dev/game-host)</p>
        <SoundProvider player={silentSoundPlayer}>
          {playScreens.map(([label, game, reconnecting, rosterOpen, suggestRotation]) => (
            <Frame key={label} label={label}>
              <div className={styles.playFrame}>
                <PlayScreen
                  layout={layout}
                  seat={2}
                  total={4}
                  displayName="Paper Cat"
                  players={fakeRoster}
                  initialRosterOpen={rosterOpen}
                  game={game}
                  reconnecting={reconnecting}
                  suggestRotation={suggestRotation ?? false}
                  onRetry={() => undefined}
                  onLeave={() => undefined}
                />
              </div>
            </Frame>
          ))}
        </SoundProvider>
      </Section>
    </div>
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

// The same components twice: in the width a portrait phone gives them, and in
// the width a landscape display gives them. Every screen has two presentation
// implementations (AGENTS.md), so the pieces they share are reviewed in both.
function Orientations({ children }: { children: ReactNode }) {
  return (
    <div className={styles.orientations}>
      <Frame label="vertical">{children}</Frame>
      <Frame label="horizontal">{children}</Frame>
    </div>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>Open a dialog</Button>
      </div>
      <Dialog
        open={open}
        title="Leave this game?"
        closeLabel="Close"
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Stay
            </Button>
            <Button onClick={() => setOpen(false)}>Leave</Button>
          </>
        }
      >
        <p>Your seat is kept for a couple of minutes in case you come back.</p>
      </Dialog>
    </>
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
        variant={music ? 'primary' : 'secondary'}
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

function CodeInputDemo({ labelVisible = false }: { labelVisible?: boolean }) {
  const [code, setCode] = useState('HO');
  return (
    <CodeInput
      value={code}
      onChange={setCode}
      length={6}
      alphabet={joinCodeAlphabet}
      label="Demo code"
      labelVisible={labelVisible}
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
        frontend: {
          url: '',
          sha256: '',
          expiresAt: '',
          viewport: { aspectRatio: '16:9', width: 1920, height: 1080 },
          assets: [],
        },
      },
      connection: 'connected',
    },
    null,
  ],
  ['Unreachable', { phase: 'closed', outcome: { kind: 'unreachable' } }, null],
  ['Game error', { phase: 'closed', outcome: { kind: 'game-error' } }, null],
  [
    'Limit reached',
    { phase: 'closed', outcome: { kind: 'rejected', reason: 'rate_limited' } },
    null,
  ],
  [
    'Session not found',
    { phase: 'closed', outcome: { kind: 'rejected', reason: 'invalid_session' } },
    null,
  ],
  [
    'Needs a keyboard',
    {
      phase: 'closed',
      outcome: {
        kind: 'rejected',
        reason: 'device_not_supported',
        requirements: { usesKeyboard: true, usesPointerHover: false, usesPointerPress: false },
      },
    },
    null,
  ],
  [
    'Needs a mouse',
    {
      phase: 'closed',
      outcome: {
        kind: 'rejected',
        reason: 'device_not_supported',
        requirements: { usesKeyboard: false, usesPointerHover: true, usesPointerPress: true },
      },
    },
    null,
  ],
  [
    'Code not found',
    { phase: 'closed', outcome: { kind: 'rejected', reason: 'invalid_join_code' } },
    null,
  ],
  [
    'Code expired',
    { phase: 'closed', outcome: { kind: 'rejected', reason: 'join_code_expired' } },
    null,
  ],
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
  ['Game stopped for misbehaving', { phase: 'closed', outcome: { kind: 'game-stopped' } }, null],
];

const playScreens: [string, GameHostStatus, boolean, boolean, boolean?][] = [
  ['Loading the game', { phase: 'starting' }, false, false],
  ['Playing', { phase: 'running', version: 1 }, false, false],
  ['Playing · players list open', { phase: 'running', version: 1 }, false, true],
  ['Playing · reconnecting', { phase: 'running', version: 1 }, true, false],
  ['Playing · turn the device', { phase: 'running', version: 1 }, false, false, true],
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
  { seat: 2, name: 'Paper Cat', hasName: true, isYou: true, status: 'active' },
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
