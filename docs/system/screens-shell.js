/* global PH */
// H2 design (T-200): the app shell, the public entry and contextual authentication.
// All `planned`. When implemented, `home` replaces `root-redirect`, and
// `auth-contextual` replaces `sign-in` + `sign-in-guest` (the provider callback
// screen `sign-in-complete` stays). Email-code sign-in is listed in the shell of
// the screen but its endpoint arrives with H3.
PH.screen({
  id: 'app-shell',
  path: '(layout around every user screen)',
  status: 'planned',
  name: 'App shell',
  summary:
    'The fixed top bar and frame every non-admin screen renders inside: identity, mode switch, language, notifications, join and create.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Fixed top bar (P14, B: search): logo/home, join, create, notifications with unread count, plan/profile or sign-up calls to action, the 3-mode switch (normal / teacher / student — teacher without a plan sees a presentation + invitation, H8) and the language selector (es / en / pt; the browser suggests, the person decides, the choice is remembered). Also the global toast/feedback layer and the non-intrusive PWA install offer for returning visitors (P01§5).',
  actions: [
    { name: 'Resolve identity, role and mode', calls: 'GET:/v1/identity/me', navigatesTo: null },
    {
      name: 'Unread notifications badge and plain entry panel',
      calls: 'GET:/v1/notifications',
      navigatesTo: null,
    },
    {
      name: 'Mark a notification read (on opening its content or explicitly; opening the panel marks nothing, P14§4)',
      calls: 'POST:/v1/notifications/{entryUUID}/read',
      navigatesTo: null,
    },
    { name: 'Go home', calls: null, navigatesTo: 'home' },
    { name: 'Join a session', calls: null, navigatesTo: 'home' },
    { name: 'Create a game', calls: null, navigatesTo: 'create-game' },
    { name: 'Sign in or see profile', calls: null, navigatesTo: 'auth-contextual' },
    {
      name: 'Change language (kept locally; on the account from H3)',
      calls: null,
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'home',
  path: '/',
  status: 'planned',
  name: 'Home / public entry',
  summary:
    'The public entry: brief product explanation, join code, visible accesses to create and to teach, and the Discovery section (approved catalog arrives in H4).',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Hero with a one-paragraph explanation and the join-code input; visible accesses to join, create a game and use Playhoot as a teacher (P14§1); a Discovery section that H2 ships as a curated placeholder and H4 replaces with the approved catalog, search and filters; a teacher band with the trial call to action. Server-rendered with per-route metadata and JSON-LD for SEO (D-019); fully usable without an account.',
  actions: [
    { name: 'Join with a code', calls: null, navigatesTo: 'join-by-code' },
    {
      name: 'Create a game (through contextual sign-in when needed)',
      calls: null,
      navigatesTo: 'create-game',
    },
    { name: 'Teach with Playhoot (teacher presentation, H8)', calls: null, navigatesTo: null },
    { name: 'Browse games (Discovery, H4)', calls: null, navigatesTo: null },
  ],
});

PH.screen({
  id: 'auth-contextual',
  path: '/sign-in',
  status: 'planned',
  name: 'Contextual sign-in',
  summary:
    'One authentication screen that receives from its caller the reason, the minimum account type that works, and the destination to return to with its data kept.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'The reason it was opened ("to join this session", "to create a game", …) and only what is needed: when a guest suffices, a display name field first with account sign-in behind a link; when a real account is required, Google featured plus one-time code by email (endpoint in H3) and the local provider in development. A guest switching to an existing account is warned identities do not merge (P03§10). When done it returns to the operation that sent it, keeping destination and entered data (P14§1, B).',
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
    {
      name: 'Continue as guest (display name only, C-01)',
      calls: 'POST:/v1/guests',
      navigatesTo: null,
    },
    { name: 'Send one-time code by email (H3)', calls: null, navigatesTo: null },
  ],
});
