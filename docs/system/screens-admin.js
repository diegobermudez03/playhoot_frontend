/* global PH */
// H2 design (T-200), built by T-206: the admin web base over the H1 endpoints.
// Admin is a mode, not a domain (D-001): these screens live in the same app
// under /admin with their own minimal shell, desktop-first with a single
// responsive implementation (V-08), and plain functional styling (SPEC_MAP §23).
PH.screen({
  id: 'admin-sign-in',
  path: '/admin/sign-in?next={path}',
  status: 'verified',
  name: 'Admin sign-in',
  summary:
    'Signs the administrator in: the account through the one contextual sign-in screen, then a TOTP code that issues the 15-minute admin-mode token.',
  mode: 'admin',
  access: 'anonymous',
  variants: 'single',
  shows:
    'Without an account signed in, one way on to the contextual sign-in screen carrying the reason `admin` and this address as its destination; with one, a 6-digit code field (purpose admin_token). A non-admin account gets not_admin, no credential yet gets not_enrolled with the way to the enrollment screen, and repeated failures show the lockout wait (V-03). When the admin token expires or is refused mid-panel, this screen is where the person lands, with the panel address as `next`, and they are returned to it.',
  actions: [
    {
      name: 'Sign the account in first (contextual screen)',
      calls: null,
      navigatesTo: 'auth-contextual',
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
  path: '/admin/second-factor?next={path}',
  status: 'verified',
  name: 'Admin second factor',
  summary: 'Enrolls or replaces the administrator TOTP credential.',
  mode: 'admin',
  access: 'account',
  variants: 'single',
  shows:
    'Enrollment: the secret and otpauth URI shown once (the QR is drawn in the browser, so neither ever reaches an outside service, and the secret is also readable as text), then the first-code confirmation. Replacing an existing credential asks for a current code, and the one in use keeps working until the new one is confirmed; a pending enrollment lapses after 10 minutes, and the screen then takes the shown secret away (D-015). Only the account with the active admin grant can enroll.',
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
  status: 'verified',
  name: 'Admin overview',
  summary: 'The admin shell and landing: navigation plus the health signals of the H1 panels.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The admin navigation (queues, budget, email, markets, texts, second factor; later milestones add their panels), who is in admin mode and how long it lasts, the way out of it, and a summary row: current restriction-ladder level with the last hour’s spend, dead tasks in all and per queue, email mode and today’s consumption, current market rules with how many are scheduled, and acceptance texts published with how many kind-language pairs are still missing. Every figure links to its panel.',
  actions: [
    { name: 'Budget summary', calls: 'GET:/admin/v1/budget', navigatesTo: 'admin-budget' },
    { name: 'Dead-task summary', calls: 'GET:/admin/v1/queues/dead', navigatesTo: 'admin-queues' },
    { name: 'Email summary', calls: 'GET:/admin/v1/email', navigatesTo: 'admin-email' },
    { name: 'Market matrix summary', calls: 'GET:/admin/v1/markets', navigatesTo: 'admin-markets' },
    { name: 'Acceptance texts summary', calls: 'GET:/admin/v1/texts', navigatesTo: 'admin-texts' },
  ],
});

PH.screen({
  id: 'admin-queues',
  path: '/admin/queues',
  status: 'verified',
  name: 'Queues and dead letters',
  summary: 'Every domain queue’s dead tasks, with retry and cancel.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'Dead tasks grouped by domain queue (newest 100 per queue, V-05): type, task id, attempts and how many times an administrator already put it back, last error and when it died. A queue that could not be read is named without hiding the rest. Retry puts a task back to pending; cancel asks in a real dialog first, because it frees the task’s idempotency key for good. A task that is no longer dead reports not_dead without failing, and one that is gone says so; the list refreshes after each action.',
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
  status: 'verified',
  name: 'Budget status',
  summary:
    'The restriction ladder and every cap’s window consumption; cost controls, emergency cutoff and gradual reopening behind inline step-up codes.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The ladder level with the reason and actor of the change that set it and when, the categories it paused and those a reopening still holds closed; per category and global: caps, measured vs estimated spend, active reservations and the cap of each window (hour / day / month), plus the last hour’s spend and the projection to the month cap. A scope with no cap is named as blocked, never as unlimited, and the categories spending without a price are called out (P32§2). Sensitive actions (set a cap, set a price, cutoff, reopen) each ask for a fresh TOTP code and a reason inline: the code becomes a single-use step-up proof sent as step_up_proof in the action’s body; a refusal shows step_up_required and asks again (D-011, D-017). The cutoff is confirmed in a real dialog. Reopening from shutdown is gradual: the first step names no category and leaves everything closed at restricted, later steps name the ones to open.',
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
  status: 'verified',
  name: 'Email mode and deliveries',
  summary: 'Outbound email: mode, per-provider consumption and delivery states.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The current mode (Automatic / Resend only / SES only) with the reason and date it was set, switchable without deploying and recorded with a new reason (P31§2), per-provider consumption against the Resend daily and monthly quotas, deliveries by state over the 30-day record window, and estimated cost. Bodies are never stored or shown (P31§5).',
  actions: [
    { name: 'Read email status', calls: 'GET:/admin/v1/email', navigatesTo: null },
    { name: 'Set email mode', calls: 'PUT:/admin/v1/email/mode', navigatesTo: null },
  ],
});

// ---------- H3 panels (designed by T-300, built by T-306): markets and acceptance texts ----------
PH.screen({
  id: 'admin-markets',
  path: '/admin/markets',
  status: 'verified',
  name: 'Market matrix',
  summary:
    'The market-and-function matrix over the H1 endpoints: current rules, scheduled ones, history, and appending a change.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'The matrix by country (and state or province where thresholds differ) and function: enabled or not, the age threshold, the pending-conditions note that keeps a market off, who changed what and why (append-only history, D-016). Appending a rule asks for the effective date (now or later, never the past) and a reason; enabling a market whose conditions note is still set asks the admin to confirm the real conditions are met and clear it (conditions_pending, 409). Values come from the answer, never from a list this build hardcodes.',
  actions: [
    {
      name: 'Read the matrix (current, scheduled, history)',
      calls: 'GET:/admin/v1/markets',
      navigatesTo: null,
    },
    { name: 'Append a market rule', calls: 'PUT:/admin/v1/markets', navigatesTo: null },
  ],
});

PH.screen({
  id: 'admin-texts',
  path: '/admin/texts',
  status: 'verified',
  name: 'Acceptance texts',
  summary:
    'The four acceptance texts by language: versions, publish dates, missing pairs, and publishing a new immutable version.',
  mode: 'admin',
  access: 'admin',
  variants: 'single',
  shows:
    'Each kind (terms, own-data, class data agreement, marketing) by language with its current version and publish date, and how many older versions stand behind it; a kind-language pair with no version is named plainly, because production serves nothing until the real text is published (CREATOR_TODO P-23) — this panel is where the creator loads them without a deploy. Publishing types the content in, previews it exactly as it will be served, warns that a version is immutable and that people will be asked to accept the new one where an operation requires a current acceptance (D-037), and records it. The current version of each pair can be read and downloaded here; `GET /v1/compliance/texts/{kind}` answers only the current one, so an older, superseded version has no content left to read anywhere (correcting the design, which promised it for every version).',
  actions: [
    { name: 'List texts and versions', calls: 'GET:/admin/v1/texts', navigatesTo: null },
    { name: 'Publish a new version', calls: 'PUT:/admin/v1/texts', navigatesTo: null },
    { name: 'Preview a served text', calls: 'GET:/v1/compliance/texts/{kind}', navigatesTo: null },
  ],
});
