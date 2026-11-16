/* global PH */
// The app shell, the public entry and contextual authentication (H2 design, T-200).
// T-204 built `app-shell` and `home`, and with them `home` replaced `root-redirect`,
// whose entry is gone. `auth-contextual` is the one authentication screen (T-205): it
// replaced `sign-in` and `sign-in-guest`, whose entries are retired; the provider
// callback screen `sign-in-complete` stays. Email-code sign-in is listed in the shell
// of that screen but its endpoint arrives with H3.
PH.screen({
  id: 'app-shell',
  path: '(layout around every user screen)',
  status: 'implemented',
  name: 'App shell',
  summary:
    'The fixed top bar and frame every non-admin screen renders inside: identity, mode switch, language, notifications, join and create.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    "Fixed top bar (P14, B: search): logo/home, join, create, notifications with the unread count and a plain entry panel, the account corner (sign in, or the person's menu), the 3-mode switch (normal / teacher / student \u2014 the two that do not exist yet explain what they will be and leave the person where they are, H8) and the language selector (es / en / pt; the browser suggests, the person decides, the choice is remembered). Also the global toast layer, the skip-to-content link, and the bar's menu, which holds the offer to install the app and, on a narrow display, the entries the bar has no room for (the mode switch below 420 px; join, create, language and sound below 760 px). It is rendered once above the router, so navigating replaces the page inside it and never rebuilds the bar; a screen only says how it wants to be framed (the whole bar, the bar without the logo, no bar while a game takes the display, or none of it in the admin area). Identity and the unread count are known only in the browser: the server renders the bar without them.",
  actions: [
    {
      name: 'Resolve who the person is (the credential the backend issued, kept by the app and renewed against it)',
      calls: null,
      navigatesTo: null,
    },
    {
      name: 'Unread notifications badge and plain entry panel (read again on every navigation)',
      calls: 'GET:/v1/notifications',
      navigatesTo: null,
    },
    {
      name: 'Mark a notification read (explicitly; opening the panel marks nothing, P14\u00a74)',
      calls: 'POST:/v1/notifications/{entryUUID}/read',
      navigatesTo: null,
    },
    { name: 'Go home', calls: null, navigatesTo: 'home' },
    { name: 'Join a session', calls: null, navigatesTo: 'enter-code' },
    { name: 'Create a game', calls: null, navigatesTo: 'create-game' },
    { name: 'Sign in or see the account menu', calls: null, navigatesTo: 'auth-contextual' },
    {
      name: 'Change language (kept locally and in a cookie; on the account from H3)',
      calls: null,
      navigatesTo: null,
    },
    { name: 'Install Playhoot (from the menu)', calls: null, navigatesTo: null },
  ],
});

PH.screen({
  id: 'home',
  path: '/{language}  (and /, which redirects to it)',
  status: 'implemented',
  name: 'Home / public entry',
  summary:
    'The public entry: brief product explanation, join code, visible accesses to create and to teach, and a curated catalog section until Discovery arrives.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Hero with the one-sentence explanation of what Playhoot is, the mascot and the join-code field with its visible label; visible accesses to create a game and to teach with Playhoot, the second of which explains that teacher mode arrives later (P14\u00a71). Then three points on what Playhoot is, a catalog section that says plainly it is our own selection of the kinds of game it is made for \u2014 no games and no activity figures are invented while Discovery is not here (P14\u00a72) \u2014 and a teacher band. Server-rendered with its metadata, hreflang alternates and JSON-LD, written out at build time, and usable without an account. A public address without a language (/, /join, /sign-in) redirects to the same page in the language the person chose, else the one the browser asks for, else English (D-022).',
  actions: [
    { name: 'Join with a code', calls: null, navigatesTo: 'join-by-code' },
    { name: 'Open the join page', calls: null, navigatesTo: 'enter-code' },
    {
      name: 'Create a game (through sign-in when the account level is missing)',
      calls: null,
      navigatesTo: 'create-game',
    },
    {
      name: 'Teach with Playhoot (explains that teacher mode arrives with H8)',
      calls: null,
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'auth-contextual',
  path: '/{language}/sign-in?reason={reason}&level={guest|account}&use=account&next={path}',
  status: 'implemented',
  name: 'Contextual sign-in',
  summary:
    'One authentication screen that receives from its caller the reason, the minimum account type that works, and the destination to return to with its data kept.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'The reason it was opened ("Join the game", "Create a game", …) as the page heading, which is where focus lands, and only what is needed below it. The address is the whole input: the reason as a kind the screen translates (never text from the caller or the backend), the weakest identity that works (`level`), whether the person asked for the account options although a guest would do (`use=account`), and where to continue (`next`, which still carries everything already typed, so nothing is asked twice — WCAG 2.2 3.3.7). Copying the address reproduces the same screen. When a guest suffices, the display-name field is the main action (C-01: a guest is asked for a name and nothing else) with the account options one link below; when an account is required, Google is featured, a disabled "code by email" entry shows where that way in will be (its endpoint arrives with H3) and the fictitious local provider of this backend appears only where it is offered. A guest who chooses an account is warned, before leaving for the provider, that a new account keeps their name and games while entering an existing one does not merge them (P03§10). When done it returns to the operation that sent it (P14§1, B).',
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
    {
      name: 'Send one-time code by email (shown, not interactive until H3)',
      calls: null,
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'offline',
  path: '/offline.html',
  status: 'implemented',
  name: 'Offline page',
  summary:
    'What the installed app shows when a page cannot reach the network: a plain explanation and a way to try again.',
  mode: 'normal',
  access: 'anonymous',
  variants: 'single',
  shows:
    "A heading, one sentence saying Playhoot needs a connection to play, and a button that reloads. It is written at build time from the message catalogs in all three languages and picks one in the browser the way the server would (the playhoot_locale cookie, then the browser's language), because it renders with no application running and no network. It claims nothing about playing offline (D-020). One implementation: it is a page of its own, not a screen of the app.",
  actions: [
    { name: 'Try again (reloads the address that failed)', calls: null, navigatesTo: null },
  ],
});
