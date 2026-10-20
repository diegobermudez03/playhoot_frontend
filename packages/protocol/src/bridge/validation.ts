import { z } from 'zod';

import { bridgeLimits, bridgeMarker, type GameToHostMessage } from './index';

// Host-side runtime validation of game -> host messages. The game is untrusted and the SDK is not
// a trust boundary (plan §16): every message is checked here, whoever produced it.

const requestId = z.number().int().positive().max(bridgeLimits.maxRequestId);
const marker = z.literal(bridgeMarker);
const plainObject = z.record(z.string(), z.unknown());

const gameToHostSchema = z.discriminatedUnion('type', [
  z.strictObject({
    bridge: marker,
    type: z.literal('ready'),
    versions: z.array(z.number().int().positive()).min(1).max(16),
  }),
  z.strictObject({ bridge: marker, type: z.literal('sample'), id: requestId, inputs: plainObject }),
  z.strictObject({
    bridge: marker,
    type: z.literal('command'),
    id: requestId,
    name: z.string().min(1).max(bridgeLimits.maxCommandNameLength),
    payload: plainObject.nullable().optional(),
  }),
  z.strictObject({
    bridge: marker,
    type: z.literal('request_asset'),
    id: requestId,
    key: z.string().min(1).max(bridgeLimits.maxAssetKeyLength),
  }),
]);

export type GameMessageDecoding =
  { ok: true; message: GameToHostMessage } | { ok: false; detail: string };

// Decodes one message posted by the game. `null` means it is not a bridge message at all (another
// script's postMessage) and is ignored without counting as a violation.
export function decodeGameMessage(value: unknown): GameMessageDecoding | null {
  if (typeof value !== 'object' || value === null) return null;
  if ((value as { bridge?: unknown }).bridge !== bridgeMarker) return null;
  let size: number;
  try {
    size = new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return { ok: false, detail: 'message is not serializable' };
  }
  if (size > bridgeLimits.maxMessageBytes)
    return { ok: false, detail: 'message over the size limit' };
  const parsed = gameToHostSchema.safeParse(value);
  if (!parsed.success) {
    const type = (value as { type?: unknown }).type;
    return { ok: false, detail: `invalid ${typeof type === 'string' ? type : 'untyped'} message` };
  }
  return { ok: true, message: parsed.data as GameToHostMessage };
}
