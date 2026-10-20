import { supportedLocales, type Locale } from '@playhoot/app-core';
import { useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../app/ServicesContext';
import { languageNames } from './catalogs';
import styles from './LanguagePicker.module.css';

// A native select: accessible and comfortable on phones without extra code.
export function LanguagePicker() {
  const { app } = useServices();
  const locale = useStore(app.store, (state) => state.locale);
  const intl = useIntl();
  return (
    <label className={styles.picker}>
      <span className={styles.globe} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
        </svg>
      </span>
      <span className={styles.visuallyHidden}>{intl.formatMessage({ id: 'language.label' })}</span>
      <select
        className={styles.select}
        value={locale}
        onChange={(event) => app.setLocale(event.target.value as Locale)}
      >
        {supportedLocales.map((option) => (
          <option key={option} value={option} lang={option}>
            {languageNames[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
