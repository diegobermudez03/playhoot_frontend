import { isSupportedLocale, type Locale } from '@playhoot/app-core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation, useNavigate } from 'react-router';

import { createBrowserLocaleStore } from '../platform/browserLocaleStore';
import { localeOfPathname, localePath, publicPathOf } from './localePaths';

interface LocaleContextValue {
  locale: Locale;
  // Changes the language: remembers it and, on a public URL, moves to the same page in it.
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

// The language the page is rendered in. The server resolves it (URL, then the remembered choice,
// then the browser's suggestion) and hands it to the first render, so there is never a flash of
// another language; afterwards the person may change it here (D-022).
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  // Set only when the person changes the language on a URL that does not carry one; a public URL
  // always wins, because its address is what it is.
  const [chosen, setChosen] = useState<Locale | null>(null);
  // What this browser remembers. The server cannot read it, so the first render agrees with the
  // server (null) and React re-renders with it once the page is hydrated.
  const remembered = useSyncExternalStore(subscribeNever, rememberedLocale, noLocale);
  const fromPath = localeOfPathname(location.pathname);
  const locale = fromPath ?? chosen ?? remembered ?? initialLocale;

  // A visit from before the choice was mirrored in a cookie: write it, so the server renders the
  // next visit in the right language from the first byte (D-024).
  useEffect(() => {
    if (remembered) createBrowserLocaleStore().save(remembered);
  }, [remembered]);

  const setLocale = useCallback(
    (next: Locale) => {
      createBrowserLocaleStore().save(next);
      setChosen(next);
      const publicPath = publicPathOf(location.pathname);
      if (publicPath) void navigate(localePath(next, publicPath) + location.search);
    },
    [location.pathname, location.search, navigate],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const subscribeNever = () => () => {};
const noLocale = () => null;

function rememberedLocale(): Locale | null {
  const saved = createBrowserLocaleStore().load();
  return saved && isSupportedLocale(saved) ? saved : null;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside <LocaleProvider>');
  return value;
}
