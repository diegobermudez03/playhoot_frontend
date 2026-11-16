import { isSupportedLocale, type Locale } from '@playhoot/app-core';
import { redirect, type ClientLoaderFunctionArgs, type LoaderFunctionArgs } from 'react-router';

import { localeFromAcceptLanguage, localeFromCookieHeader, localePath } from '../i18n/localePaths';
import {
  createBrowserLocaleStore,
  browserLanguagePreferences,
} from '../platform/browserLocaleStore';
import { resolveLocale } from '@playhoot/app-core';

// A public page without a language in its address: send the person to their own (D-022). Only the
// address changes; `next` and anything else in the query travels with it.
export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const locale =
    localeFromCookieHeader(request.headers.get('cookie')) ??
    localeFromAcceptLanguage(request.headers.get('accept-language'));
  return redirect(localePath(locale, url.pathname) + url.search, {
    // The answer depends on who asks, and the choice may change within a visit.
    headers: { Vary: 'Cookie, Accept-Language', 'Cache-Control': 'no-store' },
  });
}

// Inside the app the choice is already known, so the server is not asked again.
export function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const url = new URL(request.url);
  const saved = createBrowserLocaleStore().load();
  const locale: Locale =
    saved && isSupportedLocale(saved) ? saved : resolveLocale(browserLanguagePreferences());
  return redirect(localePath(locale, url.pathname) + url.search);
}
