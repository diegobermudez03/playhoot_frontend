import { describe, expect, it } from 'vitest';

import {
  localeCookie,
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  localeOfPathname,
  localeOfSegment,
  localePath,
  publicPathOf,
} from './localePaths';

describe('public paths carry the language', () => {
  it('puts the language in front of a public path', () => {
    expect(localePath('es', '/')).toBe('/es');
    expect(localePath('en', '/sign-in')).toBe('/en/sign-in');
    expect(localePath('pt-BR', '/sign-in/guest')).toBe('/pt/sign-in/guest');
  });

  it('reads the language back out of a path', () => {
    expect(localeOfPathname('/pt/join')).toBe('pt-BR');
    expect(localeOfPathname('/es')).toBe('es');
    // App URLs carry no language.
    expect(localeOfPathname('/games/new')).toBeNull();
    expect(localeOfPathname('/')).toBeNull();
  });

  it('does not take another first segment for a language', () => {
    expect(localeOfSegment('games')).toBeNull();
    expect(localeOfSegment('pt-BR')).toBeNull();
  });

  it('gives back the language-independent path, so a page can change language in place', () => {
    expect(publicPathOf('/es/sign-in/guest')).toBe('/sign-in/guest');
    expect(publicPathOf('/en')).toBe('/');
    expect(publicPathOf('/sessions/abc/play')).toBeNull();
  });
});

describe('which language to render in', () => {
  it('reads the remembered choice from the cookie', () => {
    expect(localeFromCookieHeader('a=1; playhoot_locale=pt-BR; b=2')).toBe('pt-BR');
    expect(localeFromCookieHeader('playhoot_locale=fr')).toBeNull();
    expect(localeFromCookieHeader(null)).toBeNull();
  });

  it('writes the cookie the server reads', () => {
    expect(localeCookie('es')).toContain('playhoot_locale=es');
    expect(localeCookie('es')).toContain('Path=/');
  });

  it('follows the browser, best language first, and falls back to English', () => {
    expect(localeFromAcceptLanguage('pt-PT,pt;q=0.9,en;q=0.5')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('en;q=0.4,es-CO;q=0.8')).toBe('es');
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9')).toBe('en');
    expect(localeFromAcceptLanguage(null)).toBe('en');
  });
});
