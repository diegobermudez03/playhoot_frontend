import { useEffect, type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';

import { catalogs } from './catalogs';
import { useLocale } from './LocaleContext';

// Tags messages may use for markup. Translators move them with the words they wrap.
const richTextElements = {
  b: (chunks: ReactNode[]) => <strong>{chunks}</strong>,
  mark: (chunks: ReactNode[]) => <strong className="i18n-mark">{chunks}</strong>,
};

// Provides the page's language to every component. The document's `lang` is rendered by the
// server; this keeps it right after a language change or a client navigation.
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();

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
