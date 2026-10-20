import type { LocalePreferenceStore } from '@playhoot/app-core';

const storageKey = 'playhoot.locale.v1';

// Browser persistence of the language the person picked. Blocked storage only means the choice
// lasts for this page.
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
    },
  };
}

export function browserLanguagePreferences(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}
