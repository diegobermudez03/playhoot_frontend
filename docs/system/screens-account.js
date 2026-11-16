/* global PH */
// H3 design (T-300): the profile area, the declaration journey, the teacher
// presentation and the notifications pages. All of these are personal, carry no
// language in the path and are never offered to crawlers, so they are app routes
// under ClientLayout; the address still reproduces each screen (path navigation).
PH.screen({
  id: 'profile',
  path: '/profile',
  status: 'planned',
  name: 'Profile',
  summary:
    "The person's own corner: who they are, their mode and language, and the doors to methods, legal, notifications and deletion.",
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Who the person is: display name with its change action (3 changes per rolling 30 days, V-10, and the screen says how many remain), guest or account, and for a guest the 90-day inactivity expiry stated plainly (P02§9) beside the upgrade offer (a new account keeps the name and games, P03§10). For an account: the mode (normal or teacher, same switch as the shell), the interface language (stored on the account, so emails follow it), and the doors to sign-in methods, legal, notification preferences and deletion; purchases and history are named with the milestone that brings them (H5, H6), inventing nothing. Without any identity the screen explains what an account gives and offers sign-in (SPEC_MAP §19: profile accessible without an account, with calls to action). Sign out is here and in the shell menu.',
  actions: [
    { name: 'Read my data', calls: 'GET:/v1/me', navigatesTo: null },
    {
      name: 'Change display name (limited per window, V-10)',
      calls: 'PUT:/v1/identity/me/display-name',
      navigatesTo: null,
    },
    {
      name: 'Change interface language (stored on the account)',
      calls: 'PUT:/v1/identity/me/language',
      navigatesTo: null,
    },
    { name: 'Switch mode', calls: 'PUT:/v1/identity/me/mode', navigatesTo: 'teacher-home' },
    { name: 'Sign out', calls: 'POST:/v1/identity/logout', navigatesTo: 'home' },
    { name: 'Sign in or create an account (CTA)', calls: null, navigatesTo: 'auth-contextual' },
    { name: 'Sign-in methods', calls: null, navigatesTo: 'profile-methods' },
    { name: 'Legal and declaration', calls: null, navigatesTo: 'profile-legal' },
    { name: 'Notification preferences', calls: null, navigatesTo: 'notification-preferences' },
    { name: 'Delete my identity', calls: null, navigatesTo: 'delete-account' },
  ],
});

PH.screen({
  id: 'profile-methods',
  path: '/profile/methods',
  status: 'planned',
  name: 'Sign-in methods',
  summary:
    'The linked ways into this account; add one by proving control of it, remove one while another remains (P03§11-12).',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'Each linked method (Google with the identity it observed, email with its address) and when it was added. Adding an email sends a code to the new address and asks for it here; adding a provider leaves for it and returns, exactly like signing in. A method already on another account is refused in place — the screen says plainly that matching emails never merge accounts (P03§11). Removal explains the guard: the last method cannot be removed, because signing in through any linked method is how an account is recovered (P03§12) — which is also why this screen recommends adding the email way in.',
  actions: [
    { name: 'List methods', calls: 'GET:/v1/identity/me/methods', navigatesTo: null },
    {
      name: 'Start linking an email (code to the new address)',
      calls: 'POST:/v1/identity/me/methods/email/start',
      navigatesTo: null,
    },
    {
      name: 'Enter the code to link the email',
      calls: 'POST:/v1/identity/me/methods/email/complete',
      navigatesTo: null,
    },
    {
      name: 'Start linking a provider',
      calls: 'POST:/v1/identity/me/methods/provider/start',
      navigatesTo: 'sign-in-complete',
    },
    {
      name: 'Remove a method (never the last one)',
      calls: 'POST:/v1/identity/me/methods/{methodID}/remove',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'profile-legal',
  path: '/profile/legal',
  status: 'planned',
  name: 'Legal and declaration',
  summary:
    'What the person declared and accepted: the residence-and-age declaration, and every acceptance text with its version and download.',
  mode: 'normal',
  access: 'guest',
  variants: 'horizontal+vertical',
  shows:
    'For an account with a declaration: the declared country, state or province and date, presented as declared — never "verified" (P19§1) — with the note that a wrong declaration is corrected through support, not by answering again (P19§3). The acceptance texts (terms, own-data processing, class data agreement, marketing) each with the current version, whether and when the caller accepted one, and the download the class agreement in particular requires (P22§2). Nothing here edits anything.',
  actions: [
    { name: 'Read my data (declaration included)', calls: 'GET:/v1/me', navigatesTo: null },
    {
      name: 'Read or download an acceptance text',
      calls: 'GET:/v1/compliance/texts/{kind}',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'delete-account',
  path: '/profile/delete',
  status: 'planned',
  name: 'Delete my identity',
  summary:
    'Deletes the guest or the account: access ends at once, data is erased on the 30/90-day clock, shared history survives with a neutral name.',
  mode: 'normal',
  access: 'guest',
  variants: 'horizontal+vertical',
  shows:
    'What deletion means before anything is asked to be confirmed: access ends immediately, games are deleted, the name disappears everywhere, erasure completes within 30 days in active systems and 90 in backups (P02§11), and sessions shared with others keep working with a neutral "deleted" reference in place of the name (P02§10). A guest is reminded first that upgrading keeps the name and games (P02§15) — the upgrade offer sits above the deletion. The confirmation is explicit (its own checked statement plus the confirm action in a dialog); done, the person lands on home signed out, and the screen never claims the erasure already finished, only that it is underway (P02§11).',
  actions: [
    {
      name: 'Upgrade instead (guests): a new account keeps name and games',
      calls: null,
      navigatesTo: 'auth-contextual',
    },
    { name: 'Delete', calls: 'POST:/v1/identity/me/delete', navigatesTo: 'home' },
  ],
});

PH.screen({
  id: 'declaration',
  path: '/declaration?function={kind}&next={path}',
  status: 'implemented',
  name: 'Residence and age declaration',
  summary:
    'The contextual declaration: a gated operation sends the person here, the declaration is recorded, and they continue where they were.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'The address is the whole input, like the sign-in screen (D-030, D-038): the function that asked (a kind this screen translates — "To create games…"; one it does not know asks the same thing without naming it), and where to continue. Country of residence, then state or province where the market rules need one (the United States and Canada, and any country the backend refuses the place of until one is given), then the single declaration — having reached the minimum age Playhoot asks for where the person lives — worded as a declaration, never as verification (P19§1), with no date of birth and no documents (P19§2). The age itself is not named before answering: nothing public tells this screen the threshold of a place, and the backend answers it only once a declaration is recorded (D-042). Saying so is the main action; saying the opposite is a separate action that confirms first, because it is recorded, binding, and leaves the function restricted — the screen then says so with the age the backend answered, and that a wrong answer is corrected through support rather than by answering again (P19§3, conflict 409). Done, the person returns to `next` with everything already typed still there (WCAG 2.2 3.3.7).',
  actions: [
    {
      name: 'Record the declaration',
      calls: 'POST:/v1/compliance/declaration',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'teacher-home',
  path: '/teacher',
  status: 'planned',
  name: 'Teacher mode',
  summary:
    'Where teacher mode lands until H8 builds teaching: an honest presentation of what it will be, with the invitation.',
  mode: 'teacher',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'What teacher mode is for — classes, activities prepared from games, grades, materials — said as what is coming (H8 builds it), the way the home treats the catalog (D-029): no invented classes, no invented figures. The invitation names the teacher plans as arriving with H6 and the trial with them; nothing is offered for sale that cannot be bought yet. Switching back to normal mode is the same shell switch that brought the person here. The teacher dashboard replaces this screen in H8.',
  actions: [{ name: 'Read my data', calls: 'GET:/v1/me', navigatesTo: null }],
});

PH.screen({
  id: 'notifications',
  path: '/notifications',
  status: 'planned',
  name: 'Notifications',
  summary:
    'The full notification history the bell panel abbreviates, with filters; this is also the page the emails link to.',
  mode: 'normal',
  access: 'guest',
  variants: 'horizontal+vertical',
  shows:
    "Every in-app notification with the endpoint's filters (domain, type, date), unread distinguished from read, translated type names for the types this build knows and the backend's wording survives for ones it does not (T-204 rule). A notification is marked read on opening its content or explicitly, never by opening this list (P14§4). A notification whose destination this build knows navigates there; destinations arrive with each milestone's own types. Emails carry a link to this page and nothing else (P31§5), so it asks for sign-in through the contextual screen when the credential is missing.",
  actions: [
    {
      name: 'List notifications (filters, history)',
      calls: 'GET:/v1/notifications',
      navigatesTo: null,
    },
    {
      name: 'Mark one read (explicitly, or on opening its content)',
      calls: 'POST:/v1/notifications/{entryUUID}/read',
      navigatesTo: null,
    },
    { name: 'Preferences', calls: null, navigatesTo: 'notification-preferences' },
  ],
});

PH.screen({
  id: 'notification-preferences',
  path: '/notifications/preferences',
  status: 'planned',
  name: 'Notification preferences',
  summary:
    'The optional email groups and the marketing choice; necessary email stays on and says so.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'The optional email groups (AI, capacity, Discovery review) each with its own switch, and marketing apart with its own (P31§4): turning marketing on shows the marketing text and records the acceptance of its exact version; turning it off records the withdrawal (P22§3, D-037). A line explains that access, security and billing email cannot be turned off because they are how problems reach the person, and that in-app notifications are never trimmed by any of this. The unsubscribe link in an email ends on this same understanding: optional email only.',
  actions: [
    { name: 'Read preferences', calls: 'GET:/v1/notifications/preferences', navigatesTo: null },
    { name: 'Set email groups', calls: 'PUT:/v1/notifications/preferences', navigatesTo: null },
    {
      name: 'Read the marketing text before accepting',
      calls: 'GET:/v1/compliance/texts/{kind}',
      navigatesTo: null,
    },
    {
      name: 'Accept or withdraw marketing (recorded at its exact version)',
      calls: 'POST:/v1/compliance/acceptances',
      navigatesTo: null,
    },
  ],
});
