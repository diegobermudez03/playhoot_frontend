import { useMemo } from 'react';

import { guestSignInRoute, enterCodePath, signInRoute, withNext } from '../features/paths';
import { localePath } from './localePaths';
import { useLocale } from './LocaleContext';

// The public pages, in the language the page is being read in (D-022). Session, game and account
// URLs carry no language and are composed in `features/paths.ts` as before.
export interface LocalePaths {
  home: string;
  enterCode: string;
  signIn: (next?: string) => string;
  guestSignIn: (next?: string) => string;
}

export function useLocalePaths(): LocalePaths {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      home: localePath(locale, '/'),
      enterCode: localePath(locale, enterCodePath),
      signIn: (next?: string) => withNext(localePath(locale, signInRoute), next),
      guestSignIn: (next?: string) => withNext(localePath(locale, guestSignInRoute), next),
    }),
    [locale],
  );
}
