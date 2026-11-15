/* global PH */
// Screens of the Session area. Only the create-session path is detailed; the rest is loaded by a later task.
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
  actions: [],
});
