import type { PendingLogin, PendingLoginStore } from '@playhoot/feature-sign-in';

const pendingLoginKey = 'playhoot.pendingLogin.v1';

// The sign-in in progress lives in this tab's sessionStorage: it survives the trip to the provider
// and back, and no other tab can complete it. Blocked storage simply means no sign-in completes.
export function createBrowserPendingLoginStore(
  storage: Storage | undefined = safeSessionStorage(),
): PendingLoginStore {
  return {
    save(pending) {
      try {
        storage?.setItem(pendingLoginKey, JSON.stringify(pending));
      } catch {
        // Not kept: the completion will report the sign-in as failed.
      }
    },
    take() {
      try {
        const raw = storage?.getItem(pendingLoginKey);
        storage?.removeItem(pendingLoginKey);
        return raw ? parsePending(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
  };
}

function parsePending(value: unknown): PendingLogin | null {
  if (typeof value !== 'object' || value === null) return null;
  const { verifier, next, startedAt } = value as Record<string, unknown>;
  if (typeof verifier !== 'string' || !verifier || typeof startedAt !== 'number') return null;
  return { verifier, next: typeof next === 'string' ? next : null, startedAt };
}

// A random verifier: 32 bytes, base64url (43 characters).
export function newLoginVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

// The verifier's S256 code challenge. `crypto.subtle` exists only in secure contexts, so a
// development build opened over plain HTTP on the local network (a phone) hashes in script.
export async function loginChallengeOf(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    : sha256(bytes);
  return base64Url(digest);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const roundConstants = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// SHA-256 (FIPS 180-4), for the insecure-context fallback only.
export function sha256(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const padded = new Uint8Array(((message.length + 9 + 63) >> 6) << 6);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const hash = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = words[i - 15]!;
      const w2 = words[i - 2]!;
      const s0 = rotate(w15, 7) ^ rotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rotate(w2, 17) ^ rotate(w2, 19) ^ (w2 >>> 10);
      words[i] = (words[i - 16]! + s0 + words[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e!, 6) ^ rotate(e!, 11) ^ rotate(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + s1 + choose + roundConstants[i]! + words[i]!) >>> 0;
      const s0 = rotate(a!, 2) ^ rotate(a!, 13) ^ rotate(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + majority) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d! + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) hash[i] = (hash[i]! + next[i]!) >>> 0;
  }
  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) out.setUint32(i * 4, hash[i]!);
  return digest;
}

function safeSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
