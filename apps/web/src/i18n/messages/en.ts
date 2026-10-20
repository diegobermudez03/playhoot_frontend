// Source catalog. Every message is a whole sentence in ICU MessageFormat: placeholders are
// named ({code}), plurals and choices live inside the message ({n, plural, ...}), and markup is a
// tag (<b>…</b>). Translations reorder freely; never build sentences by concatenating pieces.
export const en = {
  'app.tagline': 'Game night, anywhere.',
  'app.homeLink': 'Playhoot home',
  'language.label': 'Language',
  'sound.mute': 'Turn sound off',
  'sound.unmute': 'Turn sound on',

  'enterCode.title': 'Join a game',
  'enterCode.codeLabel': 'Game code',
  'enterCode.join': 'Join',
  'enterCode.footnote': 'Got a code from your host? Type it above.',

  'identity.title': 'What should we call you?',
  'identity.joining': "You're joining game <mark>{code}</mark>",
  'identity.nameLabel': 'Your name',
  'identity.namePlaceholder': 'e.g. Night Owl',
  'identity.nameHint': 'This is how other players will see you.',
  'identity.submit': "Let's play",
  'identity.error.empty': 'Type a name to continue.',
  'identity.error.tooLong': 'Use at most {max} characters.',
  'identity.error.rejected': "That name can't be used. Try another one.",
  'identity.error.rateLimited':
    '{seconds, plural, =0 {Too many tries. Wait a moment and try again.} one {Too many tries. Wait # second and try again.} other {Too many tries. Wait # seconds and try again.}}',
  'identity.error.unavailable': "We couldn't reach Playhoot. Try again in a moment.",

  'connecting.joining': 'Joining the game…',
  'connecting.joiningCode': 'Joining {code}…',
  'connecting.reconnecting': 'Connection lost. Reconnecting…',
  'connecting.leaving': 'Leaving the game…',

  'lobby.title': "You're in!",
  'lobby.waiting': 'Waiting for the host to start the game',
  'lobby.invite.title': 'Invite friends',
  'lobby.invite.withCode': 'Share this code or the link',
  'lobby.invite.withoutCode': 'Send them the link to this game.',
  'lobby.invite.codeLabel': 'Join code {code}',
  'lobby.invite.copy': 'Copy invite link',
  'lobby.invite.copied': 'Link copied!',
  'lobby.players': 'Players',
  'lobby.you': 'You',
  'lobby.playerName': 'Player {seat}',
  'lobby.leave': 'Leave game',

  'started.title': 'Game on!',
  'started.body': "You're player <b>{seat}</b> of {total}. Loading the game…",
  'started.bodyNamed': "{name}, you're player <b>{seat}</b> of {total}. Loading the game…",

  'outcome.unreachable.title': "We couldn't find that game",
  'outcome.unreachable.body':
    'The code may be mistyped or expired, or the game already started. Check it with your host.',
  'outcome.lobbyFull.title': 'This game is full',
  'outcome.lobbyFull.body': 'Every seat is taken. Ask your host to start another round.',
  'outcome.sessionStarted.title': 'This game already started',
  'outcome.sessionStarted.body': 'Only people who were in the lobby can play this round.',
  'outcome.cannotRejoin.title': "You can't rejoin this game",
  'outcome.cannotRejoin.body': 'The game carried on without you. Catch the next round!',
  'outcome.busy.title': 'Playhoot is busy right now',
  'outcome.busy.body': 'Give it a moment and try again.',
  'outcome.unavailable.title': "This game isn't available",
  'outcome.unavailable.body': 'It may have ended or expired. Ask your host for a new code.',
  'outcome.lobbyExpired.title': 'The lobby closed',
  'outcome.lobbyExpired.body': 'The game never started and the lobby timed out.',
  'outcome.hostClosedLobby.title': 'The host closed the game',
  'outcome.hostClosedLobby.body': 'This round was cancelled before it started.',
  'outcome.hostEnded.title': 'The host ended the game',
  'outcome.hostEnded.body': 'This round was stopped before the finish.',
  'outcome.finished.title': 'Game over!',
  'outcome.finished.body': 'Thanks for playing.',
  'outcome.ended.title': 'This game has ended',
  'outcome.ended.body': 'The round is over.',
  'outcome.replaced.title': 'You opened this game somewhere else',
  'outcome.replaced.body': 'This tab is no longer connected. You can keep playing here instead.',
  'outcome.connectionLost.title': 'Connection lost',
  'outcome.connectionLost.body': "We couldn't reach the game. Check your internet and try again.",
  'outcome.protocolError.title': 'Something went wrong',
  'outcome.protocolError.body':
    'The game and this page stopped understanding each other. Trying again usually fixes it.',
  'outcome.left.title': 'You left the game',
  'outcome.left.body': 'Come back any time with a code.',
  'outcome.action.retry': 'Try again',
  'outcome.action.playHere': 'Play here',
  'outcome.action.enterCode': 'Enter a code',

  'notFound.title': 'Nothing here',
  'notFound.body': 'This page flew away.',
  'error.title': 'Something went wrong',
  'common.goHome': 'Go home',
} as const;

export type MessageId = keyof typeof en;
export type Messages = Record<MessageId, string>;
