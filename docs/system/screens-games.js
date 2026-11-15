/* global PH */
// Screens of game authoring: the account's games, creation, the workspace and its sections, and the
// external-AI connection screens (OAuth/MCP consent and connected apps).
PH.screen({
  id: 'my-games',
  path: '/games',
  status: 'implemented',
  name: 'My games',
  summary: "The account's own games, newest first, each leading to its workspace.",
  mode: 'normal',
  access: 'account',
  variants: 'single',
  shows:
    'Name, published/visibility, open edition and last-updated date per game; a create button.',
  actions: [
    { name: 'List my games', calls: 'GET:/v1/games', navigatesTo: null },
    { name: 'Open a game', calls: null, navigatesTo: 'game-workspace' },
    { name: 'Create a game', calls: null, navigatesTo: 'create-game' },
  ],
});

PH.screen({
  id: 'create-game',
  path: '/games/new',
  status: 'implemented',
  name: 'Create game',
  summary: 'Names a new game, optionally from a template, and moves to its workspace.',
  mode: 'normal',
  access: 'account',
  variants: 'single',
  shows:
    'A name field and a template picker (featured templates, search, inspection) or the starter project.',
  actions: [
    { name: 'Browse featured templates', calls: 'GET:/v1/templates', navigatesTo: null },
    { name: 'Search templates', calls: 'GET:/v1/templates/search', navigatesTo: null },
    { name: 'Inspect a template', calls: 'GET:/v1/templates/{id}', navigatesTo: null },
    { name: 'Read a template file', calls: 'GET:/v1/templates/{id}/files', navigatesTo: null },
    { name: 'Create the game', calls: 'POST:/v1/games', navigatesTo: 'game-workspace' },
  ],
});

PH.screen({
  id: 'game-workspace',
  path: '/games/:gameUUID/edit',
  status: 'implemented',
  name: 'Game workspace — AI changes',
  summary:
    "A game's workspace, opened on its AI-changes section by default; every section shares this route with ?section=.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'The brief (agreed game and phase) and a field to paste a change JSON from the AI, plus the section nav (AI changes, Files, Resources, Build, Test game, Scenarios, History, Share, Card and publishing).',
  actions: [
    { name: 'Read the draft', calls: 'GET:/v1/games/{g}/draft', navigatesTo: null },
    { name: 'Apply a pasted change', calls: 'POST:/v1/games/{g}/draft/changes', navigatesTo: null },
    { name: 'Open Files', calls: null, navigatesTo: 'game-workspace-files' },
    { name: 'Open Resources', calls: null, navigatesTo: 'game-workspace-assets' },
    { name: 'Open Build', calls: null, navigatesTo: 'game-workspace-build' },
    { name: 'Open Test game', calls: null, navigatesTo: 'game-workspace-preview' },
    { name: 'Open Scenarios', calls: null, navigatesTo: 'game-workspace-scenarios' },
    { name: 'Open History', calls: null, navigatesTo: 'game-workspace-history' },
    { name: 'Open Share with my AI', calls: null, navigatesTo: 'game-workspace-share' },
    { name: 'Open Card and publishing', calls: null, navigatesTo: 'game-workspace-publish' },
  ],
});

PH.screen({
  id: 'game-workspace-files',
  path: '/games/:gameUUID/edit?section=files',
  status: 'implemented',
  name: 'Game workspace — Files',
  summary: "A game's draft files: view, edit and save as a new revision.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows: 'The current file tree and the open file, editable.',
  actions: [
    {
      name: 'Save the file as a new revision',
      calls: 'POST:/v1/games/{g}/draft/changes',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'game-workspace-assets',
  path: '/games/:gameUUID/edit?section=assets',
  status: 'implemented',
  name: 'Game workspace — Resources',
  summary: 'Declares and manages the image, audio and video assets of the draft.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'Declared assets with their state, size, and image dimensions or clip duration once uploaded.',
  actions: [
    {
      name: 'Upload or replace an asset',
      calls: 'PUT:/v1/games/{g}/draft/assets/{key}',
      navigatesTo: null,
    },
    {
      name: 'Remove an asset',
      calls: 'POST:/v1/games/{g}/draft/assets/{key}/remove',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'game-workspace-build',
  path: '/games/:gameUUID/edit?section=build',
  status: 'implemented',
  name: 'Game workspace — Build',
  summary: "The current revision's build state and diagnostics.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows: 'Build status badge and a per-line diagnostic list.',
  actions: [
    {
      name: 'Read the build (long poll)',
      calls: 'GET:/v1/games/{g}/draft/build',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'game-workspace-preview',
  path: '/games/:gameUUID/edit?section=preview',
  status: 'implemented',
  name: 'Game workspace — Test game',
  summary:
    'A private match of the current build with synthetic participants; the creator can play as each one.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'Preview controls (pause, resume, restart, end) and the running game for the acted-as participant.',
  actions: [
    { name: 'Start a preview', calls: 'POST:/v1/games/{g}/draft/previews', navigatesTo: null },
    {
      name: 'Connect to the preview',
      calls: 'WS:/v1/play/previews/{previewUUID}/connect',
      navigatesTo: null,
    },
    { name: 'Open Build for diagnostics', calls: null, navigatesTo: 'game-workspace-build' },
  ],
});

PH.screen({
  id: 'game-workspace-scenarios',
  path: '/games/:gameUUID/edit?section=scenarios',
  status: 'implemented',
  name: 'Game workspace — Scenarios',
  summary: 'Pastes and runs a scripted scenario against the current build, with expectations.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows: 'A pasted scenario, its run summary (or the full JSON), and state inspection.',
  actions: [
    {
      name: 'Run a scenario (pasted, saved, or all)',
      calls: 'POST:/v1/games/{g}/draft/simulations',
      navigatesTo: null,
    },
    {
      name: 'Inspect simulated state',
      calls: 'GET:/v1/games/{g}/draft/simulations/{id}/state',
      navigatesTo: null,
    },
    { name: 'Open Build for diagnostics', calls: null, navigatesTo: 'game-workspace-build' },
  ],
});

PH.screen({
  id: 'game-workspace-history',
  path: '/games/:gameUUID/edit?section=history',
  status: 'implemented',
  name: 'Game workspace — History',
  summary: 'Draft revisions: list, compare, restore, or start over from a template.',
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows: 'A paginated revision list, a diff between two revisions, and the template picker.',
  actions: [
    { name: 'List revisions', calls: 'GET:/v1/games/{g}/draft/revisions', navigatesTo: null },
    { name: 'Compare revisions', calls: 'GET:/v1/games/{g}/draft/diff', navigatesTo: null },
    { name: 'Restore a revision', calls: 'POST:/v1/games/{g}/draft/restore', navigatesTo: null },
    {
      name: 'Start over from a template',
      calls: 'POST:/v1/games/{g}/draft/template',
      navigatesTo: null,
    },
  ],
});

PH.screen({
  id: 'game-workspace-share',
  path: '/games/:gameUUID/edit?section=share',
  status: 'implemented',
  name: 'Game workspace — Share with my AI',
  summary: "Creates, renews or revokes the game's link for the creator's own external AI.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'Whether a link is active, and the link itself right after creating it (shown once, in memory only).',
  actions: [
    { name: 'Read link state', calls: 'GET:/v1/games/{g}/ai-link', navigatesTo: null },
    { name: 'Create (or renew) the link', calls: 'POST:/v1/games/{g}/ai-link', navigatesTo: null },
    { name: 'Revoke the link', calls: 'POST:/v1/games/{g}/ai-link/revoke', navigatesTo: null },
  ],
});

PH.screen({
  id: 'game-workspace-publish',
  path: '/games/:gameUUID/edit?section=publish',
  status: 'implemented',
  name: 'Game workspace — Card and publishing',
  summary: "The game's card (name, description, logo, photos) and its publication.",
  mode: 'normal',
  access: 'account',
  variants: 'horizontal+vertical',
  shows:
    'The card fields, publish controls (public/private, blockers), "new version" and a link to create a Session of the game.',
  actions: [
    { name: 'Read the card', calls: 'GET:/v1/games/{g}', navigatesTo: null },
    { name: 'Update the card', calls: 'PATCH:/v1/games/{g}', navigatesTo: null },
    { name: 'Upload the logo', calls: 'PUT:/v1/games/{g}/logo', navigatesTo: null },
    { name: 'Remove the logo', calls: 'POST:/v1/games/{g}/logo/remove', navigatesTo: null },
    { name: 'Upload a photo', calls: 'POST:/v1/games/{g}/photos', navigatesTo: null },
    { name: 'Remove a photo', calls: 'POST:/v1/games/{g}/photos/{id}/remove', navigatesTo: null },
    {
      name: 'Publish the current revision',
      calls: 'POST:/v1/games/{g}/publish',
      navigatesTo: null,
    },
    { name: 'Open a new edition', calls: 'POST:/v1/games/{g}/editions', navigatesTo: null },
    { name: 'Create a session of the game', calls: null, navigatesTo: 'new-session' },
  ],
});

PH.screen({
  id: 'connect-ai',
  path: '/connect-ai',
  status: 'implemented',
  name: 'Connect AI',
  summary: "OAuth/MCP consent: an external AI app asks to work with the account's games.",
  mode: 'normal',
  access: 'account',
  variants: 'single',
  shows: "The asking app's name and return host, what it can and cannot do, Allow/Deny.",
  actions: [
    {
      name: 'Read the authorization request',
      calls: 'GET:/v1/ai-authorizations/{requestID}',
      navigatesTo: null,
    },
    { name: 'Approve', calls: 'POST:/v1/ai-authorizations/{requestID}/approve', navigatesTo: null },
    { name: 'Deny', calls: 'POST:/v1/ai-authorizations/{requestID}/deny', navigatesTo: null },
  ],
});

PH.screen({
  id: 'ai-connections',
  path: '/account/ai-connections',
  status: 'implemented',
  name: 'Connected AIs',
  summary: "The account's connected AI apps, each revocable.",
  mode: 'normal',
  access: 'account',
  variants: 'single',
  shows:
    'Each connection with its client name, connected-since and last-used dates, and a revoke button.',
  actions: [
    { name: 'List connections', calls: 'GET:/v1/ai-connections', navigatesTo: null },
    {
      name: 'Revoke a connection',
      calls: 'POST:/v1/ai-connections/{id}/revoke',
      navigatesTo: null,
    },
  ],
});
