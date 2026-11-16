import { describe, expect, it } from 'vitest';
import type { MetaDescriptor } from 'react-router';

import { homeJsonLd, publicRouteMeta } from './meta';

const meta = (overrides: Partial<Parameters<typeof publicRouteMeta>[0]> = {}) =>
  publicRouteMeta({
    origin: 'https://playhoot.test',
    locale: 'es',
    path: '/',
    titleId: 'seo.home.title',
    descriptionId: 'seo.home.description',
    ...overrides,
  });

const find = (descriptors: MetaDescriptor[], match: (d: Record<string, unknown>) => boolean) =>
  descriptors.filter((d) => match(d as Record<string, unknown>)) as Record<string, unknown>[];

describe('public route metadata', () => {
  it('describes the page in its own language', () => {
    const descriptors = meta();
    expect(descriptors[0]).toEqual({ title: expect.stringContaining('juega') });
    expect(find(descriptors, (d) => d.name === 'description')[0]?.content).toContain('código');
  });

  it('points the canonical at the address of the page itself', () => {
    expect(find(meta(), (d) => d.rel === 'canonical')[0]?.href).toBe('https://playhoot.test/es');
    expect(
      find(meta({ locale: 'pt-BR', path: '/sign-in' }), (d) => d.rel === 'canonical')[0]?.href,
    ).toBe('https://playhoot.test/pt/sign-in');
  });

  it('offers every language as an alternate, with English as the default', () => {
    const alternates = find(meta({ path: '/join' }), (d) => d.rel === 'alternate');
    expect(alternates.map((d) => [d.hrefLang, d.href])).toEqual([
      ['es', 'https://playhoot.test/es/join'],
      ['en', 'https://playhoot.test/en/join'],
      ['pt-BR', 'https://playhoot.test/pt/join'],
      ['x-default', 'https://playhoot.test/en/join'],
    ]);
  });

  it('keeps pages that are only reached from a page out of search results', () => {
    expect(find(meta({ noindex: true }), (d) => d.name === 'robots')[0]?.content).toBe(
      'noindex, follow',
    );
    expect(find(meta(), (d) => d.name === 'robots')).toEqual([]);
  });

  it('declares what the site is, in the language of the page', () => {
    const descriptors = meta({ jsonLd: homeJsonLd('https://playhoot.test', 'pt-BR') });
    const jsonLd = descriptors.find((d) => 'script:ld+json' in (d as object)) as Record<
      string,
      Record<string, unknown>
    >;
    expect(jsonLd['script:ld+json']).toMatchObject({
      '@type': 'WebSite',
      inLanguage: 'pt-BR',
      url: 'https://playhoot.test/pt',
    });
  });
});
