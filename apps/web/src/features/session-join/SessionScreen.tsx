import type {
  IdentityError,
  JoinSessionState,
  JoinView,
  LobbyMember,
} from '@playhoot/feature-session-join';
import { guestDisplayNameMaxLength } from '@playhoot/protocol';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';

import { useSound, type SoundId } from '../../sound';
import { Avatar, Button, Card, CodeTiles, Confetti, Owl, Stage, TextField } from '../../ui';
import {
  outcomeActionLabels,
  outcomeCopy,
  type OutcomeAction,
  type OutcomeTone,
} from './outcomeCopy';
import styles from './SessionScreen.module.css';

export interface SessionScreenActions {
  submitDisplayName(displayName: string): void;
  retry(): void;
  leave(): void;
  enterAnotherCode(): void;
  copyInvite(): Promise<boolean>;
}

export interface SessionScreenProps {
  state: JoinSessionState;
  // The code to show and share, when the person came with one.
  joinCode: string | null;
  // The local name of the person playing, if they chose one.
  displayName: string | null;
  actions: SessionScreenActions;
  // Development-only identity shortcuts rendered under the name form.
  devIdentity?: ReactNode;
}

// Web presentation of the Join Session feature: one screen per phase of the feature state.
// Every text comes from the message catalogs (apps/web/src/i18n).
export function SessionScreen(props: SessionScreenProps) {
  const { view } = props.state;
  switch (view.phase) {
    case 'identity':
      return <IdentityStep view={view} {...props} />;
    case 'connecting':
      return <ConnectingStep reconnectAttempt={view.reconnectAttempt} joinCode={props.joinCode} />;
    case 'lobby':
      return <LobbyStep members={view.members} {...props} />;
    case 'leaving':
      return <ConnectingStep reconnectAttempt={0} joinCode={null} leaving />;
    case 'started':
      return <StartedStep view={view} displayName={props.displayName} />;
    case 'closed':
      return <OutcomeStep view={view} actions={props.actions} />;
  }
}

function IdentityStep({
  view,
  joinCode,
  actions,
  devIdentity,
}: SessionScreenProps & { view: Extract<JoinView, { phase: 'identity' }> }) {
  const intl = useIntl();
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    actions.submitDisplayName(name);
  };

  return (
    <Stage>
      <div className={styles.hero}>
        <Owl size={88} />
        <h1 className={styles.title}>
          <FormattedMessage id="identity.title" />
        </h1>
        {joinCode && (
          <p className={styles.lead}>
            <FormattedMessage id="identity.joining" values={{ code: joinCode }} />
          </p>
        )}
      </div>
      <Card>
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label={intl.formatMessage({ id: 'identity.nameLabel' })}
            placeholder={intl.formatMessage({ id: 'identity.namePlaceholder' })}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={guestDisplayNameMaxLength}
            autoComplete="nickname"
            autoFocus
            error={view.error ? identityErrorText(intl, view.error) : null}
            hint={intl.formatMessage({ id: 'identity.nameHint' })}
          />
          <Button type="submit" size="lg" block loading={view.submitting}>
            <FormattedMessage id="identity.submit" />
          </Button>
        </form>
      </Card>
      {devIdentity}
    </Stage>
  );
}

function identityErrorText(intl: IntlShape, error: IdentityError): string {
  switch (error.kind) {
    case 'invalid-name':
      return error.reason === 'empty'
        ? intl.formatMessage({ id: 'identity.error.empty' })
        : error.reason === 'too-long'
          ? intl.formatMessage({ id: 'identity.error.tooLong' }, { max: error.maxLength })
          : intl.formatMessage({ id: 'identity.error.rejected' });
    case 'rate-limited':
      return intl.formatMessage(
        { id: 'identity.error.rateLimited' },
        { seconds: error.retryAfterSeconds ?? 0 },
      );
    case 'unavailable':
      return intl.formatMessage({ id: 'identity.error.unavailable' });
  }
}

function ConnectingStep({
  reconnectAttempt,
  joinCode,
  leaving = false,
}: {
  reconnectAttempt: number;
  joinCode: string | null;
  leaving?: boolean;
}) {
  return (
    <Stage>
      <div className={styles.waiting} role="status" aria-live="polite">
        <Owl size={112} animated />
        <p className={styles.waitingText}>
          {leaving ? (
            <FormattedMessage id="connecting.leaving" />
          ) : reconnectAttempt > 0 ? (
            <FormattedMessage id="connecting.reconnecting" />
          ) : joinCode ? (
            <FormattedMessage id="connecting.joiningCode" values={{ code: joinCode }} />
          ) : (
            <FormattedMessage id="connecting.joining" />
          )}
        </p>
      </div>
    </Stage>
  );
}

function LobbyStep({
  members,
  joinCode,
  displayName,
  actions,
}: SessionScreenProps & { members: LobbyMember[] }) {
  const intl = useIntl();
  const sound = useSound();
  const [copied, setCopied] = useState(false);
  const previousCount = useRef(members.length);

  useEffect(() => {
    sound.play('join');
    sound.startMusic('lobby');
    return () => sound.stopMusic();
  }, [sound]);

  useEffect(() => {
    if (members.length > previousCount.current) sound.play('player-joined');
    if (members.length < previousCount.current) sound.play('player-left');
    previousCount.current = members.length;
  }, [members.length, sound]);
  const invite = async () => {
    if (await actions.copyInvite()) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <Stage wide>
      <div className={styles.lobbyHeader}>
        <h1 className={styles.title}>
          <FormattedMessage id="lobby.title" />
        </h1>
        <p className={styles.lead}>
          <span className={styles.pulse} aria-hidden="true" />
          <FormattedMessage id="lobby.waiting" />
        </p>
      </div>
      <div className={styles.lobbyGrid}>
        <Card className={styles.inviteCard}>
          <h2 className={styles.cardTitle}>
            <FormattedMessage id="lobby.invite.title" />
          </h2>
          {joinCode ? (
            <>
              <p className={styles.muted}>
                <FormattedMessage id="lobby.invite.withCode" />
              </p>
              <div
                className={styles.codeRow}
                role="img"
                aria-label={intl.formatMessage(
                  { id: 'lobby.invite.codeLabel' },
                  { code: joinCode.split('').join(' ') },
                )}
              >
                <CodeTiles code={joinCode} size="lg" />
              </div>
            </>
          ) : (
            <p className={styles.muted}>
              <FormattedMessage id="lobby.invite.withoutCode" />
            </p>
          )}
          <Button variant="secondary" block onClick={invite} sound="copy">
            <FormattedMessage id={copied ? 'lobby.invite.copied' : 'lobby.invite.copy'} />
          </Button>
        </Card>
        <Card className={styles.playersCard}>
          <div className={styles.playersHead}>
            <h2 className={styles.cardTitle}>
              <FormattedMessage id="lobby.players" />
            </h2>
            <span key={members.length} className={`${styles.count} motion-bump`}>
              {intl.formatNumber(members.length)}
            </span>
          </div>
          <ul className={styles.players}>
            {members.map((member, index) => {
              const name = memberName(intl, member, index, displayName);
              return (
                <li
                  key={member.userUUID}
                  className={member.isYou ? `${styles.player} ${styles.you}` : styles.player}
                  style={{ '--motion-index': index } as CSSProperties}
                >
                  <Avatar
                    seat={index + 1}
                    label={name}
                    text={member.isYou && displayName ? undefined : intl.formatNumber(index + 1)}
                    highlighted={member.isYou}
                  />
                  <span className={styles.playerName}>{name}</span>
                  {member.isYou && (
                    <span className={styles.badge}>
                      <FormattedMessage id="lobby.you" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <div className={styles.footerActions}>
        <Button variant="ghost" onClick={actions.leave} sound={null}>
          <FormattedMessage id="lobby.leave" />
        </Button>
      </div>
    </Stage>
  );
}

function StartedStep({
  view,
  displayName,
}: {
  view: Extract<JoinView, { phase: 'started' }>;
  displayName: string | null;
}) {
  const sound = useSound();
  useEffect(() => sound.play('game-start'), [sound]);
  const seat = view.session.participants.findIndex((p) => p.isYou) + 1;
  const total = view.session.participants.length;
  return (
    <Stage>
      <div className={styles.waiting} role="status" aria-live="polite">
        <Confetti />
        <Owl size={112} mood="surprised" entrance="hop" />
        <h1 className={styles.title}>
          <FormattedMessage id="started.title" />
        </h1>
        <p className={styles.lead}>
          {displayName ? (
            <FormattedMessage id="started.bodyNamed" values={{ name: displayName, seat, total }} />
          ) : (
            <FormattedMessage id="started.body" values={{ seat, total }} />
          )}
        </p>
      </div>
    </Stage>
  );
}

function OutcomeStep({
  view,
  actions,
}: {
  view: Extract<JoinView, { phase: 'closed' }>;
  actions: SessionScreenActions;
}) {
  const copy = outcomeCopy(view.outcome);
  const sound = useSound();
  const outcomeSound: SoundId = view.outcome.kind === 'left' ? 'leave' : toneSounds[copy.tone];
  useEffect(() => sound.play(outcomeSound), [sound, outcomeSound]);
  const run: Record<OutcomeAction, () => void> = {
    retry: actions.retry,
    'play-here': actions.retry,
    'enter-code': actions.enterAnotherCode,
  };
  return (
    <Stage>
      <div className={styles.hero}>
        {copy.tone === 'celebration' && <Confetti />}
        <Owl
          size={104}
          mood={copy.mood}
          entrance={
            copy.tone === 'problem' ? 'shake' : copy.tone === 'celebration' ? 'hop' : 'none'
          }
        />
        <h1 className={styles.title}>
          <FormattedMessage id={copy.title} />
        </h1>
        <p className={styles.lead}>
          <FormattedMessage id={copy.body} />
        </p>
      </div>
      <div className={styles.outcomeActions}>
        {copy.actions.map((action, index) => (
          <Button
            key={action}
            variant={index === 0 ? 'primary' : 'secondary'}
            size="lg"
            block
            onClick={run[action]}
          >
            <FormattedMessage id={outcomeActionLabels[action]} />
          </Button>
        ))}
      </div>
    </Stage>
  );
}

// Other players have no names yet: the backend does not return them (BACKEND_CONTRACT.md G3).
function memberName(
  intl: IntlShape,
  member: LobbyMember,
  index: number,
  displayName: string | null,
): string {
  if (member.isYou) return displayName ?? intl.formatMessage({ id: 'lobby.you' });
  return intl.formatMessage({ id: 'lobby.playerName' }, { seat: index + 1 });
}

const toneSounds: Record<OutcomeTone, SoundId> = {
  problem: 'error',
  farewell: 'ended',
  celebration: 'ended',
};
