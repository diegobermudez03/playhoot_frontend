import type { LocalePreferenceStore } from '@playhoot/app-core';

import { localeCookie } from '../i18n/localePaths';

const storageKey = 'playhoot.locale.v1';

// Browser persistence of the language the person picked. Blocked storage only means the choice
// lasts for this page. The same choice is mirrored in a cookie because the server renders the
// first page of a visit and only sees cookies (D-024).
export function createBrowserLocaleStore(): LocalePreferenceStore {
  return {
    load() {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    save(locale) {
      try {
        window.localStorage.setItem(storageKey, locale);
      } catch {
        // Not persisted.
      }
      try {
        document.cookie = localeCookie(locale);
      } catch {
        // Not persisted; the server falls back to the browser's language.
      }
    },
  };
}

export function browserLanguagePreferences(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}
