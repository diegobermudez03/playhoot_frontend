/* global PH */
// H2 design (T-200): the admin web base over the H1 endpoints. All `planned`.
// Admin is a mode, not a domain (D-001): these screens live in the same app
// under /admin with their own minimal shell, desktop-first with a single
// responsive implementation (V-08), and plain functional styling (SPEC_MAP §23).
PH.screen({
  id: 'admin-sign-in',
  path: '/admin/sign-in',
  status: 'planned',
  name: 'Admin sign-in',
  summary:
    'Signs the administrator in: normal account sign-in, then a TOTP code that issues the 15-minute admin-mode token.',
  mode: 'admin',
  access: 'anonymous',
  variants: 'single',
  shows:
    'The account sign-in (reusing the contextual screen pieces) followed by a 6-digit code field (purpose admin_token). A non-admin account gets not_admin; lockout after repeated failures shows the retry wait (V-03). When the admin token expires mid-work, this screen is where the person lands, returning to where they were.',
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
      name: 'Verify code for an admin token',
      calls: 'POST:/v1/identity/totp/verify',
      navigatesTo: 'admin-home',
    },
    { name: 'Enroll a second factor first', calls: null, navigatesTo: 'admin-second-factor' },
  ],
});

PH.screen({
  id: 'admin-second-factor',
  path: '/admin/second-factor',
  status: 'planned',
  name: 'Admin second factor',
  summary: 'Enrolls or replaces the administrator TOTP credential.',
  mode: 'admin',
  access: 'account',
  variants: 'single',
  shows:
    'Enrollment: the secret and otpauth URI shown once (QR + copyable text), then the first-code confirmation. Replacing an existing credential asks for a current code; a pending enrollment lapses after 10 minutes (D-015). Only the account with the active admin grant can enroll.',
  actions: [
    { name: 'Start enrollment', calls: 'POST:/v1/identity/totp/enroll', navigatesTo: null },
    {
      name: 'Confirm with the first code',
      calls: 'POST:/v1/identity/totp/confirm',
      navigatesTo: 'admin-sign-in',
    },
  ],
});

PH.screen({
  id: 'admin-home',
  path: '/admin',
  status: 'planned',
  name: 'Admin overview',
  summary: 'The admin shell and landing: navigation plus the health signals of the H1 panels.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The admin navigation (queues, budget, email; later milestones add their panels) and a summary row: current restriction-ladder level, dead tasks per queue, email mode and today’s consumption. Every number links to its panel.',
  actions: [
    { name: 'Budget summary', calls: 'GET:/admin/v1/budget', navigatesTo: 'admin-budget' },
    { name: 'Dead-task summary', calls: 'GET:/admin/v1/queues/dead', navigatesTo: 'admin-queues' },
    { name: 'Email summary', calls: 'GET:/admin/v1/email', navigatesTo: 'admin-email' },
  ],
});

PH.screen({
  id: 'admin-queues',
  path: '/admin/queues',
  status: 'planned',
  name: 'Queues and dead letters',
  summary: 'Every domain queue’s dead tasks, with retry and cancel.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'Dead tasks grouped by domain queue (newest 100 per queue, V-05): type, idempotency key, attempts, last error, when it died. Retry puts a task back to pending; cancel frees its key. A task that is no longer dead reports not_dead without failing; the list refreshes after each action.',
  actions: [
    { name: 'List dead tasks', calls: 'GET:/admin/v1/queues/dead', navigatesTo: null },
    {
      name: 'Retry a dead task',
      calls: 'POST:/admin/v1/queues/dead/{taskUUID}/retry',
      navigatesTo: null,
    },
    {
      name: 'Cancel a dead task',
      calls: 'POST:/admin/v1/queues/dead/{taskUUID}/cancel',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'admin-budget',
  path: '/admin/budget',
  status: 'planned',
  name: 'Budget status',
  summary:
    'The restriction ladder and every cap’s window consumption; cost controls, emergency cutoff and gradual reopening behind inline step-up codes.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'Ladder level with its reason and history; per category and global: caps, measured vs estimated spend, active reservations and projection per window (hour / day / month). Sensitive actions (set controls, cutoff, reopen) each ask for a fresh TOTP code inline: the code becomes a single-use step-up proof sent as step_up_proof in the action’s body; a refusal shows step_up_required and asks again (D-011, D-017). Reopening from shutdown is gradual: first call closes everything at restricted, later calls name categories to open.',
  actions: [
    { name: 'Read budget status', calls: 'GET:/admin/v1/budget', navigatesTo: null },
    { name: 'Get a step-up proof', calls: 'POST:/v1/identity/totp/verify', navigatesTo: null },
    { name: 'Set caps and rates', calls: 'PUT:/admin/v1/budget/controls', navigatesTo: null },
    { name: 'Emergency cutoff', calls: 'POST:/admin/v1/budget/cutoff', navigatesTo: null },
    { name: 'Reopen one step', calls: 'POST:/admin/v1/budget/reopen', navigatesTo: null },
  ],
});

PH.screen({
  id: 'admin-email',
  path: '/admin/email',
  status: 'planned',
  name: 'Email mode and deliveries',
  summary: 'Outbound email: mode, per-provider consumption and delivery states.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The current mode (Automatic / Resend only / SES only) switchable without deploying (P31§2), per-provider consumption against the Resend quotas, deliveries by state (sent, refused, uncertain) over the 30-day record window, and estimated cost. Bodies are never stored or shown (P31§5).',
  actions: [
    { name: 'Read email status', calls: 'GET:/admin/v1/email', navigatesTo: null },
    { name: 'Set email mode', calls: 'PUT:/admin/v1/email/mode', navigatesTo: null },
  ],
});
