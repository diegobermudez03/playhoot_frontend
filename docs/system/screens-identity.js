/* global PH */
// Screens of entry, sign-in and the no-match fallback.
PH.screen({
  id: 'root-redirect',
  path: '/',
  status: 'implemented',
  name: 'Root',
  summary: 'There is no home page yet: immediately sends everyone to the code entry.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows: 'Nothing; redirects at once.',
  actions: [{ name: 'Redirect', calls: null, navigatesTo: 'enter-code' }],
});

PH.screen({
  id: 'enter-code',
  path: '/join',
  status: 'implemented',
  name: 'Enter code',
  summary: 'Logo, tagline and a 6-character join code input, with shortcuts to create or manage.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Logo and tagline, the code input, and three buttons (create a session, create a game, my games) that go through sign-in first when the account level is missing.',
  actions: [
    { name: 'Join by code', calls: null, navigatesTo: 'join-by-code' },
    { name: 'Create a session', calls: null, navigatesTo: 'new-session' },
    { name: 'Create a game', calls: null, navigatesTo: 'create-game' },
    { name: 'My games', calls: null, navigatesTo: 'my-games' },
  ],
});

PH.screen({
  id: 'sign-in',
  path: '/sign-in',
  status: 'implemented',
  name: 'Sign in',
  summary:
    'Signs in or registers with an account (Google, and a fictitious local provider in development).',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'A Google button and, where offered, a local-account button; a notice if a guest is switching.',
  actions: [
    {
      name: 'List available providers',
      calls: 'GET:/v1/identity/login/providers',
      navigatesTo: null,
    },
    {
      name: 'Start provider sign-in',
      calls: 'POST:/v1/identity/login/start',
      navigatesTo: 'sign-in-complete',
    },
  ],
});

PH.screen({
  id: 'sign-in-guest',
  path: '/sign-in/guest',
  status: 'implemented',
  name: 'Sign in as guest',
  summary: 'Plays as a guest by giving a display name, with a link to sign in or register instead.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'A name field and a link to the account sign-in, with the join code being joined if there is one.',
  actions: [
    { name: 'Create guest', calls: 'POST:/v1/guests', navigatesTo: null },
    { name: 'Sign in with an account instead', calls: null, navigatesTo: 'sign-in' },
  ],
});

PH.screen({
  id: 'sign-in-complete',
  path: '/sign-in/complete',
  status: 'implemented',
  name: 'Sign-in complete',
  summary:
    'Where the provider sends the person back; exchanges the one-time code and continues where sign-in started.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows: 'A working indicator, or the error with a button back to sign-in.',
  actions: [
    {
      name: 'Complete provider sign-in',
      calls: 'POST:/v1/identity/login/complete',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'not-found',
  path: '*',
  status: 'implemented',
  name: 'Not found',
  summary: 'Fallback for any path that matches no route.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows: 'A 404 notice with a "Go home" button.',
  actions: [{ name: 'Go home', calls: null, navigatesTo: 'root-redirect' }],
});
