#!/usr/bin/env node
// Development stand-in for the host experience, which the web app does not have yet.
// Creates a Session on the local backend as a test account, prints its join link, connects as
// its admin, prints the lobby, and starts the game when you press Enter.
//
//   node scripts/dev-host.mjs [--game <gameUUID>] [--backend http://localhost:8081] [--web http://localhost:5173]
//
// Uses the backend's placeholder test tokens (docs/architecture/BACKEND_CONTRACT.md G3). Node
// sends no Origin header, which the backend's WebSocket origin check accepts.
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, i, all) =>
        arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs,
      [],
    ),
);
const backend = args.backend ?? 'http://localhost:8081';
const web = args.web ?? 'http://localhost:5173';
// Space Drift, the backend's seed game.
const game = args.game ?? '33333333-3333-4333-8333-333333333333';
const hostToken = 'test-user-1';

const response = await fetch(`${backend}/v1/sessions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${hostToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ game_uuid: game, idempotency_key: randomUUID() }),
}).catch((error) => {
  console.error(`Could not reach the backend at ${backend}: ${error.message}`);
  process.exit(1);
});
const created = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Creating the Session failed (${response.status}):`, created);
  process.exit(1);
}

console.log(`\nSession ${created.session_uuid}`);
console.log(`Join code ${created.join_code}  (lobby open until ${created.lobby_expires_at})`);
console.log(`\n  Open: ${web}/join/${created.join_code}\n`);

const token = Buffer.from(hostToken).toString('base64url');
const wsUrl = `${backend.replace(/^http/, 'ws')}/v1/play/join/sessions/${created.session_uuid}/admin`;
const socket = new WebSocket(wsUrl, [
  'playhoot.v1',
  `base64url.bearer.authorization.playhoot.${token}`,
]);

socket.onopen = () =>
  console.log('Admin connected. Press Enter to start the game, Ctrl+C to quit.');
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case 'lobby_update':
      console.log(
        `Lobby: ${message.members.length} player(s)`,
        message.members.map((m) => m.user_uuid),
      );
      break;
    case 'start_session_result':
      console.log(`Start: ${message.outcome}`);
      break;
    case 'session_started':
      console.log(`Started with ${message.participants.length} participant(s).`);
      break;
    case 'player_view':
      break;
    default:
      console.log(message);
  }
};
socket.onclose = (event) => {
  console.log(`Admin connection closed (${event.code} ${event.reason})`);
  process.exit(0);
};

readline.createInterface({ input: process.stdin }).on('line', () => {
  socket.send(JSON.stringify({ type: 'start_session' }));
});
