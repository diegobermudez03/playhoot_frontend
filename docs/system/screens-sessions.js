/* global PH */
// Screens of the Session area: create, host and the two Join Session URLs (by code and by Session UUID).
PH.screen({
  id: 'new-session',
  path: '/sessions/new',
  status: 'implemented',
  name: 'Create session',
  summary: 'Creates a Session for the chosen game as soon as it opens.',
  mode: 'normal',
  access: 'account',
  variants: 'single',
  shows:
    'A "Creating…" message, or the error (game unavailable, active session limit, other) with a retry button.',
  actions: [
    {
      name: 'Create the Session (on open, and on retry)',
      calls: 'POST:/v1/sessions',
      navigatesTo: 'host-lobby',
    },
  ],
});

PH.screen({
  id: 'host-lobby',
  path: '/sessions/:sessionUUID/host',
  status: 'implemented',
  name: 'Host lobby',
  summary: "The host's view of a Session: lobby, then the running game.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    "Join code and link, players, player limits, Start, Join to play, Cancel; during the game, any participant's view.",
  actions: [
    {
      name: 'Open the admin connection (lobby, start, cancel, watch a participant)',
      calls: 'WS:/v1/play/join/sessions/{sessionUUID}/admin',
      navigatesTo: null,
    },
    { name: 'Join to play, as a participant', calls: null, navigatesTo: 'session-play' },
    { name: 'Cancel the Session', calls: null, navigatesTo: 'enter-code' },
  ],
});

PH.screen({
  id: 'join-by-code',
  path: '/join/:joinCode',
  status: 'implemented',
  name: 'Join by code',
  summary:
    'Resolves a join code and connects as a player; moves to the Session URL once it is known.',
  mode: 'normal',
  access: 'guest',
  variants: 'horizontal+vertical',
  shows: 'Connecting, then the lobby (invitation, players with presence) and the running game.',
  actions: [
    {
      name: 'Connect as a player by code',
      calls: 'WS:/v1/play/join/{joinCode}',
      navigatesTo: null,
    },
    { name: 'Replace the URL once the Session is known', calls: null, navigatesTo: 'session-play' },
    { name: 'Leave', calls: null, navigatesTo: 'enter-code' },
  ],
});

PH.screen({
  id: 'session-play',
  path: '/sessions/:sessionUUID/play',
  status: 'implemented',
  name: 'Session play',
  summary:
    'Plays a Session already known by its UUID (reconnection, or the creator playing their own).',
  mode: 'normal',
  access: 'guest',
  variants: 'horizontal+vertical',
  shows: 'Connecting, then the lobby (invitation, players with presence) and the running game.',
  actions: [
    {
      name: 'Connect as a player by Session',
      calls: 'WS:/v1/play/join/sessions/{sessionUUID}/player',
      navigatesTo: null,
    },
    { name: 'Leave', calls: null, navigatesTo: 'enter-code' },
  ],
});
