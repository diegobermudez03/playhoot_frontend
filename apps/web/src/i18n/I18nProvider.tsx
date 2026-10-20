import { useEffect, type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../app/ServicesContext';
import { catalogs } from './catalogs';

// Tags messages may use for markup. Translators move them with the words they wrap.
const richTextElements = {
  b: (chunks: ReactNode[]) => <strong>{chunks}</strong>,
  mark: (chunks: ReactNode[]) => <strong className="i18n-mark">{chunks}</strong>,
};

// Provides the person's language (app-global state) to every component.
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useStore(useServices().app.store, (state) => state.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <IntlProvider
      locale={locale}
      messages={catalogs[locale]}
      defaultLocale="en"
      defaultRichTextElements={richTextElements}
      // A missing translation falls back to the source text; the catalog test prevents it.
      onError={(error) => {
        if (import.meta.env.DEV) console.warn(error.message);
      }}
    >
      {children}
    </IntlProvider>
  );
}
