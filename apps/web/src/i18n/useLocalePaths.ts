import { useMemo } from 'react';

import { authPath, enterCodePath, type AuthOptions } from '../features/paths';
import { localePath } from './localePaths';
import { useLocale } from './LocaleContext';

// The public pages, in the language the page is being read in (D-022). Session, game and account
// URLs carry no language and are composed in `features/paths.ts` as before.
export interface LocalePaths {
  home: string;
  enterCode: string;
  // The contextual authentication screen, with the reason, the level and the destination it needs.
  auth: (options?: AuthOptions) => string;
}

export function useLocalePaths(): LocalePaths {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      home: localePath(locale, '/'),
      enterCode: localePath(locale, enterCodePath),
      auth: (options?: AuthOptions) => localeAuthPath(locale, options),
    }),
    [locale],
  );
}

// `authPath` composes the language-independent address; the language goes in front of its path,
// never in front of its query.
function localeAuthPath(locale: Parameters<typeof localePath>[0], options?: AuthOptions): string {
  const path = authPath(options);
  const cut = path.indexOf('?');
  return cut === -1
    ? localePath(locale, path)
    : localePath(locale, path.slice(0, cut)) + path.slice(cut);
}
