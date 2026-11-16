import { fallbackLocale, type Locale } from '@playhoot/app-core';
import type { MetaArgs, MetaDescriptor } from 'react-router';

import { catalogs, type MessageId } from '../i18n/catalogs';
import { localeOfPathname, localePath, localeSegments, segmentOfLocale } from '../i18n/localePaths';
import type { RootData } from '../root';

// Metadata is built outside React, so it reads the catalogs directly. Only whole, argument-free
// messages belong here; anything a person reads inside a page still goes through react-intl.
export function text(locale: Locale, id: MessageId): string {
  return catalogs[locale][id];
}

export interface PublicRouteMeta {
  origin: string;
  locale: Locale;
  // The language-independent public path, as listed in `localePublicPaths`.
  path: string;
  titleId: MessageId;
  descriptionId: MessageId;
  // Structured data the route declares, already language-resolved.
  jsonLd?: Record<string, unknown>;
  // Pages that exist for people but not for search results.
  noindex?: boolean;
}

// Title, description, canonical, the alternates of every language, Open Graph and optional
// JSON-LD for a public route (D-019). Every public route uses this, so a page can never be
// indexed in one language under another language's address.
export function publicRouteMeta(options: PublicRouteMeta): MetaDescriptor[] {
  const title = text(options.locale, options.titleId);
  const description = text(options.locale, options.descriptionId);
  const canonical = `${options.origin}${localePath(options.locale, options.path)}`;
  const alternates: MetaDescriptor[] = Object.entries(localeSegments).map(([locale]) => ({
    tagName: 'link',
    rel: 'alternate',
    hrefLang: locale,
    href: `${options.origin}${localePath(locale as Locale, options.path)}`,
  }));
  const descriptors: MetaDescriptor[] = [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: canonical },
    ...alternates,
    {
      tagName: 'link',
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${options.origin}${localePath('en', options.path)}`,
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Playhoot' },
    { property: 'og:locale', content: openGraphLocale(options.locale) },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: `${options.origin}/assets/images/og-share.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
  if (options.noindex) descriptors.push({ name: 'robots', content: 'noindex, follow' });
  if (options.jsonLd) descriptors.push({ 'script:ld+json': options.jsonLd });
  return descriptors;
}

// Open Graph wants an underscore and a region: the language alone is ambiguous there.
const openGraphLocales: Record<Locale, string> = {
  es: 'es_ES',
  en: 'en_US',
  'pt-BR': 'pt_BR',
};

function openGraphLocale(locale: Locale): string {
  return openGraphLocales[locale];
}

// What Playhoot is, for a search engine reading the home page of a language.
export function homeJsonLd(origin: string, locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Playhoot',
    url: `${origin}/${segmentOfLocale(locale)}`,
    inLanguage: locale,
    description: text(locale, 'seo.home.description'),
  };
}

// What a route module needs to describe itself: the language comes from its own address, the
// origin from the root route.
export function publicMeta(
  args: MetaArgs,
  options: Pick<PublicRouteMeta, 'path' | 'titleId' | 'descriptionId' | 'noindex'> & {
    jsonLd?: (origin: string, locale: Locale) => Record<string, unknown>;
  },
): MetaDescriptor[] {
  const locale = localeOfPathname(args.location.pathname) ?? fallbackLocale;
  const root = args.matches.find((match) => match?.id === 'root');
  const origin = (root?.data as RootData | undefined)?.origin ?? '';
  return publicRouteMeta({
    origin,
    locale,
    path: options.path,
    titleId: options.titleId,
    descriptionId: options.descriptionId,
    ...(options.noindex === undefined ? {} : { noindex: options.noindex }),
    ...(options.jsonLd ? { jsonLd: options.jsonLd(origin, locale) } : {}),
  });
}
