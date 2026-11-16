/* global PH */
// Screens of entry, the provider callback and the no-match fallback. The public
// entry itself is `home` (screens-shell.js), and the one authentication screen is
// `auth-contextual` there; the redirect from a public address that names no
// language is described there too, since that is where it lands.
PH.screen({
  id: 'enter-code',
  path: '/{language}/join',
  status: 'verified',
  name: 'Enter code',
  summary:
    'Logo, tagline and a 6-character join code input, with shortcuts to create or manage. Reached from home and from the top bar.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Logo and tagline, the code input, and three buttons (create a session, create a game, my games) that go through the contextual authentication screen first when the account level is missing, each naming its own reason. It is offered to crawlers (it is in the sitemap), so the server renders the page itself in the language its address names rather than an empty document the browser fills in; the shell knows from the address that this page shows its own big logo, so the bar never shows a second one. Before the app is interactive the three buttons simply go to their destination, which gates itself.',
  actions: [
    { name: 'Join by code', calls: null, navigatesTo: 'join-by-code' },
    { name: 'Create a session', calls: null, navigatesTo: 'new-session' },
    { name: 'Create a game', calls: null, navigatesTo: 'create-game' },
    { name: 'My games', calls: null, navigatesTo: 'my-games' },
  ],
});

PH.screen({
  id: 'sign-in-complete',
  path: '/sign-in/complete',
  status: 'verified',
  name: 'Sign-in complete',
  summary:
    'Where the provider sends the person back; exchanges the one-time code and continues where sign-in started.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows:
    'A working indicator, or the error with a button back to sign-in. From H3 it also completes a provider round trip whose intent was linking a method (the pending state the app kept says which), landing back on the methods screen.',
  actions: [
    {
      name: 'Complete provider sign-in',
      calls: 'POST:/v1/identity/login/complete',
      navigatesTo: null,
    },
    {
      name: 'Complete linking a provider (H3)',
      calls: 'POST:/v1/identity/me/methods/provider/complete',
      navigatesTo: 'profile-methods',
    },
  ],
});

PH.screen({
  id: 'not-found',
  path: '*',
  status: 'verified',
  name: 'Not found',
  summary: 'Fallback for any path that matches no route.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows: 'A 404 notice with a "Go home" button.',
  actions: [{ name: 'Go home', calls: null, navigatesTo: 'home' }],
});
