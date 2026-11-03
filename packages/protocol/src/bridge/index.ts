// Versioned Game <-> Host bridge contract (ADR-0005), imported by both the Game SDK and the Host.
// Types and constants only: the Game SDK is bundled into every game artifact, so this module must
// stay dependency-free. The Host's runtime validators live in `./validation`.

// Every bridge message carries this marker, so stray messages of other origins are ignored.
export const bridgeMarker = 'playhoot.bridge';

// Bridge versions this code speaks, newest last. A game announces the versions its SDK speaks in
// `ready`; the Host picks the newest both speak. A version is never changed once released: a
// change is a new version, so old GameVersion artifacts stay interpretable.
// Version 2 (ADR-0005 amendment, 2026-11-02) adds the presentation context: `start` carries it and
// `presentation` updates it. Version 1 games never receive either.
export const bridgeVersions = [1, 2] as const;
export type BridgeVersion = (typeof bridgeVersions)[number];

// Limits the Host enforces on game -> host messages (the SDK respects them too).
export const bridgeLimits = {
  // Same as the backend's realtime message limit: anything bigger could never be sent on anyway.
  maxMessageBytes: 32 * 1024,
  maxCommandNameLength: 64,
  maxAssetKeyLength: 128,
  // Correlation ids are chosen by the game; they only need to be unique among its pending requests.
  maxRequestId: Number.MAX_SAFE_INTEGER,
} as const;

// Game assets (ADR-0008): what a game may declare, and the MIME types each type is delivered as.
// The backend enforces the same catalog for a GameVersion's assets.
export const gameAssetTypes = ['image', 'audio', 'video'] as const;
export type GameAssetType = (typeof gameAssetTypes)[number];

export const gameAssetMimeTypes: Record<GameAssetType, readonly string[]> = {
  image: ['image/png', 'image/webp', 'image/jpeg', 'image/svg+xml'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  video: ['video/mp4', 'video/webm'],
};

// A logical key is written as a key of an object literal in the game, so it is identifier-like.
export const gameAssetKeyPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

// Rates the Host allows game -> host messages at (ADR-0006), as a short and a long window like the
// backend's own limits. `message` counts every bridge message, valid or not, before it is even
// decoded. Messages beyond a limit are dropped; a game still over its limits after
// `abuseSeconds` seconds in a row is stopped and reported as abusing the bridge.
export const bridgeRates = {
  message: { perSecond: 240, perMinute: 14_400 },
  // Twice the backend's SAMPLE rate, so a game sampling every frame on a fast display is fine.
  sample: { perSecond: 120, perMinute: 7_200 },
  command: { perSecond: 20, perMinute: 300 },
  request_asset: { perSecond: 20, perMinute: 300 },
  maxPendingCommands: 16,
  maxPendingAssets: 8,
  abuseSeconds: 5,
} as const;

// ─── Game -> Host ──────────────────────────────────────────────────────────

// The game is listening and wants to start. Sent once, after the game registered its handlers.
export interface ReadyMessage {
  bridge: typeof bridgeMarker;
  type: 'ready';
  versions: number[];
}

// A full snapshot of the player's logical inputs. `id` is the game's own sample number (grows by
// one per sample); acknowledgements come back in the same numbering.
export interface GameSampleMessage {
  bridge: typeof bridgeMarker;
  type: 'sample';
  id: number;
  inputs: Record<string, unknown>;
}

// A discrete game action. `id` correlates the `command_result`.
export interface GameCommandMessage {
  bridge: typeof bridgeMarker;
  type: 'command';
  id: number;
  name: string;
  payload?: Record<string, unknown> | null;
}

// Asks the Host for a game asset by its logical key. `id` correlates the `asset` answer.
export interface AssetRequestMessage {
  bridge: typeof bridgeMarker;
  type: 'request_asset';
  id: number;
  key: string;
}

export type GameToHostMessage =
  ReadyMessage | GameSampleMessage | GameCommandMessage | AssetRequestMessage;

// ─── Host -> Game ──────────────────────────────────────────────────────────

// Who the player is in this Session. Participant ids are the Session's, never user ids.
export interface GameContext {
  participantId: string;
  participants: string[];
  // BCP 47 language of the platform UI, so a game with text can match it.
  locale: string;
}

// How the game is shown on this device (bridge v2). The game always draws in its fixed logical
// viewport; this says what that becomes on the screen, so text and targets can stay legible.
export interface Presentation {
  // CSS pixels of the device per logical pixel of the game (the Host's fit scale).
  scale: number;
  // The game's size on the screen, in CSS pixels.
  width: number;
  height: number;
  // Device pixels per CSS pixel.
  pixelRatio: number;
  // The part of each edge the device covers (notch, rounded corners), in logical pixels.
  safeArea: { top: number; right: number; bottom: number; left: number };
  // How much room the game really has: compact on a phone, spacious on a large screen.
  density: PresentationDensity;
  // The main pointer: coarse for touch, fine for a mouse.
  pointer: 'coarse' | 'fine';
  reducedMotion: boolean;
  highContrast: boolean;
}

export const presentationDensities = ['compact', 'regular', 'spacious'] as const;
export type PresentationDensity = (typeof presentationDensities)[number];

// The player's view of the game: the backend's PlayerProjection with patches already applied.
export interface Projection {
  state: unknown;
  // True when this projection is a new baseline (first one, or after a resync): the game should
  // snap to it instead of interpolating from the previous one.
  full: boolean;
  // The game's last sample id the backend has consumed (0: none yet), for prediction/reconciliation.
  ack: number;
}

// The answer to `ready`: the bridge version both speak, the context and the current projection.
export interface StartMessage {
  bridge: typeof bridgeMarker;
  type: 'start';
  version: BridgeVersion;
  context: GameContext;
  projection: Projection | null;
  // Bridge v2 only.
  presentation?: Presentation;
}

// The presentation changed (a resize, a rotation, a preference). Bridge v2 only.
export interface PresentationMessage {
  bridge: typeof bridgeMarker;
  type: 'presentation';
  presentation: Presentation;
}

// What the backend produced for this player since the last update. `projection` is absent when
// only the ack or transient events/errors are new, or while a resync is pending.
export interface UpdateMessage {
  bridge: typeof bridgeMarker;
  type: 'update';
  projection?: Projection;
  ack: number;
  // Game events and logical errors addressed to this player, delivered once.
  events: unknown[];
  errors: unknown[];
}

// How a command ended, as the game needs it.
//   executed:    the game ran it; `response` is what the game script answered.
//   rejected:    the backend or the Host judged it invalid (undeclared, bad payload, too large).
//   unavailable: it could not run now (Session not running, connection lost, rate limited).
export type GameCommandOutcome = 'executed' | 'rejected' | 'unavailable';

export interface CommandResultMessage {
  bridge: typeof bridgeMarker;
  type: 'command_result';
  id: number;
  outcome: GameCommandOutcome;
  response?: unknown;
}

// An asset's bytes, or why there are none. The game turns the bytes into a local URL; it never
// sees where they came from.
export type AssetMessage =
  | {
      bridge: typeof bridgeMarker;
      type: 'asset';
      id: number;
      key: string;
      found: true;
      mimeType: string;
      bytes: ArrayBuffer;
    }
  | { bridge: typeof bridgeMarker; type: 'asset'; id: number; key: string; found: false };

// The Host refuses to continue (no common bridge version). The game should stop.
export interface IncompatibleMessage {
  bridge: typeof bridgeMarker;
  type: 'incompatible';
  supported: number[];
}

export type HostToGameMessage =
  | StartMessage
  | UpdateMessage
  | CommandResultMessage
  | AssetMessage
  | IncompatibleMessage
  | PresentationMessage;

// Chooses the newest bridge version both sides speak, or null.
export function negotiateBridgeVersion(offered: readonly number[]): BridgeVersion | null {
  for (let i = bridgeVersions.length - 1; i >= 0; i -= 1) {
    const version = bridgeVersions[i];
    if (version !== undefined && offered.includes(version)) return version;
  }
  return null;
}

export function isBridgeMessage(value: unknown): value is { bridge: string; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { bridge?: unknown }).bridge === bridgeMarker &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

// The density of a game shown with `shortSide` CSS pixels on its short side.
export function densityFor(shortSide: number): PresentationDensity {
  if (shortSide < 480) return 'compact';
  if (shortSide < 900) return 'regular';
  return 'spacious';
}
