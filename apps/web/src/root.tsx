import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './ui/tokens.css';
import './ui/motion.css';

import { fallbackLocale, type Locale } from '@playhoot/app-core';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
  type LinksFunction,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunction,
} from 'react-router';

import { RouteError } from './app/RouteError';
import { I18nProvider } from './i18n/I18nProvider';
import { LocaleProvider } from './i18n/LocaleContext';
import {
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  localeOfPathname,
} from './i18n/localePaths';
import { siteOrigin } from './seo/siteOrigin';

export interface RootData {
  // The language this document is rendered in.
  locale: Locale;
  // The public origin every absolute URL in the metadata is built on.
  origin: string;
}

// The language of the page and the origin of its links, decided before anything renders: the URL
// when it names a language, then the remembered choice, then what the browser asks for (D-022).
export function loader({ request }: LoaderFunctionArgs): RootData {
  const url = new URL(request.url);
  return {
    locale:
      localeOfPathname(url.pathname) ??
      localeFromCookieHeader(request.headers.get('cookie')) ??
      localeFromAcceptLanguage(request.headers.get('accept-language')),
    origin: siteOrigin(url),
  };
}

// Nothing here changes inside a visit except the language in the URL, so navigating does not ask
// the server again.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
  localeOfPathname(currentUrl.pathname) !== localeOfPathname(nextUrl.pathname);

export const links: LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/assets/icons/apple-touch-icon.png' },
  { rel: 'manifest', href: '/site.webmanifest' },
];

export function useRootData(): RootData {
  const data = useRouteLoaderData('root') as RootData | undefined;
  return data ?? { locale: fallbackLocale, origin: '' };
}

// The document itself. React Router renders this around every page, including an error page.
export function Layout({ children }: { children: ReactNode }) {
  const { locale } = useRootData();
  return (
    <html lang={locale}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        {/* No frame may load or navigate anywhere: the game runs in a srcdoc iframe, which this
            allows, and must not carry data away in its frame's URL (ADR-0006). */}
        <meta httpEquiv="Content-Security-Policy" content="frame-src 'none'" />
        {/* No request tells another site which page it came from (a sign-in's code is in a URL). */}
        <meta name="referrer" content="no-referrer" />
        <meta name="theme-color" content="#141134" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { locale } = useRootData();
  return (
    <Providers locale={locale}>
      <RouteFocus />
      <Outlet />
    </Providers>
  );
}

// A failure anywhere below, including before the app exists, still shows a translated page.
export function ErrorBoundary() {
  const { locale } = useRootData();
  return (
    <Providers locale={locale}>
      <RouteError />
    </Providers>
  );
}

function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleProvider initialLocale={locale}>
      <I18nProvider>{children}</I18nProvider>
    </LocaleProvider>
  );
}

// WCAG 2.2 AA: a client navigation replaces the page without reloading it, so focus is moved to
// the new page's heading; screen readers then announce where they are. The first page of a visit
// keeps the browser's own focus.
function RouteFocus() {
  const { key } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const heading = document.querySelector('main h1') ?? document.querySelector('h1');
    if (!(heading instanceof HTMLElement)) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [key]);
  return null;
}
