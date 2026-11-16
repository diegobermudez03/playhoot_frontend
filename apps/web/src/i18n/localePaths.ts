import {
  fallbackLocale,
  isSupportedLocale,
  resolveLocale,
  supportedLocales,
  type Locale,
} from '@playhoot/app-core';

// The segment each language takes in a public URL (D-022). Brazilian Portuguese is `/pt`: the
// path names the language, not the regional catalog behind it.
export const localeSegments = { es: 'es', en: 'en', 'pt-BR': 'pt' } as const satisfies Record<
  Locale,
  string
>;

export type LocaleSegment = (typeof localeSegments)[Locale];

export const localeSegmentList: readonly LocaleSegment[] = supportedLocales.map(
  (locale) => localeSegments[locale],
);

// Public paths that exist in every language. Each one is reachable as `/<segment><path>`, and the
// bare path redirects to the person's language. Session and account URLs are not here: they are
// private links, carry no language and are never indexed.
export const localePublicPaths = ['/', '/join', '/sign-in', '/sign-in/guest'] as const;

// Public paths offered to crawlers (sitemap). Sign-in pages are not worth indexing.
export const indexablePublicPaths = ['/', '/join'] as const;

export function segmentOfLocale(locale: Locale): LocaleSegment {
  return localeSegments[locale];
}

export function localeOfSegment(segment: string | undefined): Locale | null {
  if (!segment) return null;
  const found = supportedLocales.find((locale) => localeSegments[locale] === segment);
  return found ?? null;
}

// The language a public URL names, or null when the path carries none (every app route).
export function localeOfPathname(pathname: string): Locale | null {
  return localeOfSegment(pathname.split('/')[1]);
}

// The same public path in `locale`. `path` is one of `localePublicPaths`.
export function localePath(locale: Locale, path: string): string {
  const segment = segmentOfLocale(locale);
  return path === '/' ? `/${segment}` : `/${segment}${path}`;
}

// The public path a locale-prefixed URL points at ("/es/sign-in" -> "/sign-in"), or null when the
// URL carries no language.
export function publicPathOf(pathname: string): string | null {
  if (!localeOfPathname(pathname)) return null;
  const rest = pathname.slice(1).split('/').slice(1).join('/');
  return rest ? `/${rest}` : '/';
}

// The cookie the browser keeps beside the stored preference, so the server can honour the chosen
// language on the first request of a visit (D-024).
export const localeCookieName = 'playhoot_locale';
const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function localeCookie(locale: Locale): string {
  return `${localeCookieName}=${encodeURIComponent(locale)}; Path=/; Max-Age=${localeCookieMaxAgeSeconds}; SameSite=Lax`;
}

export function localeFromCookieHeader(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name !== localeCookieName) continue;
    const decoded = decodeURIComponent(value.join('='));
    if (isSupportedLocale(decoded)) return decoded;
  }
  return null;
}

// What the browser asks for, best first. Unparseable entries are ignored rather than guessed at.
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return fallbackLocale;
  const preferences = header
    .split(',')
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([0-9.]+)\s*$/.exec(parameter))
        .find(Boolean);
      return { tag: (tag ?? '').trim(), quality: quality ? Number(quality[1]) : 1 };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
  return resolveLocale(preferences);
}
