import { describe, expect, it } from 'vitest';

import { cacheNameFor, cachesToDelete, strategyFor, type RequestFacts } from './swPolicy';

const origin = 'https://playhoot.example';
const precached = new Set(['/offline.html', '/site.webmanifest', '/favicon.svg']);

function facts(overrides: Partial<RequestFacts> & { url: string }): RequestFacts {
  return { method: 'GET', mode: 'no-cors', origin, ...overrides };
}

describe('what the service worker does with a request', () => {
  it('never touches a backend call', () => {
    for (const path of ['/v1', '/v1/identity/me', '/admin/v1/email/mode']) {
      expect(strategyFor(facts({ url: `${origin}${path}` }), precached)).toBe('bypass');
    }
  });

  it('never touches a WebSocket handshake', () => {
    const request = facts({ url: `${origin}/v1/sessions/abc/socket`, upgrade: 'websocket' });
    expect(strategyFor(request, precached)).toBe('bypass');
  });

  it('never touches anything that is not a plain read', () => {
    expect(strategyFor(facts({ url: `${origin}/games`, method: 'POST' }), precached)).toBe(
      'bypass',
    );
  });

  it('never touches another site', () => {
    expect(strategyFor(facts({ url: 'https://accounts.google.com/o/oauth2' }), precached)).toBe(
      'bypass',
    );
  });

  it('goes to the network for a page, with the offline page behind it', () => {
    const request = facts({ url: `${origin}/es/join`, mode: 'navigate' });
    expect(strategyFor(request, precached)).toBe('navigate');
  });

  it('treats a page carrying a sign-in code as a page, so it is never stored', () => {
    const request = facts({ url: `${origin}/sign-in/complete?code=secret`, mode: 'navigate' });
    expect(strategyFor(request, precached)).toBe('navigate');
  });

  it('serves the installed shell from the cache', () => {
    expect(strategyFor(facts({ url: `${origin}/offline.html` }), precached)).toBe('precached');
  });

  it('serves a file whose name carries its content hash from the cache', () => {
    const request = facts({ url: `${origin}/assets/entry.client-BQ3kd91x.js` });
    expect(strategyFor(request, precached)).toBe('immutable');
  });

  it('leaves anything else to the browser', () => {
    expect(strategyFor(facts({ url: `${origin}/assets/sounds/tap.mp3` }), precached)).toBe(
      'bypass',
    );
  });
});

describe('the caches a build keeps', () => {
  it('deletes every other build and nothing that is not ours', () => {
    const keep = cacheNameFor('b2');
    const existing = [cacheNameFor('b1'), keep, 'some-other-app-cache'];
    expect(cachesToDelete(existing, keep)).toEqual([cacheNameFor('b1')]);
  });
});
