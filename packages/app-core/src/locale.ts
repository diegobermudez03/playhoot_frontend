// Languages the platform is offered in (BCP 47 tags). French is planned; adding a language
// means adding its tag here and its message catalog in each app.
export const supportedLocales = ['es', 'en', 'pt-BR'] as const;
export type Locale = (typeof supportedLocales)[number];

// Used when none of the person's preferred languages is supported.
export const fallbackLocale: Locale = 'en';

// Platform persistence of the language the person chose explicitly.
export interface LocalePreferenceStore {
  load(): string | null;
  save(locale: Locale): void;
}

export function isSupportedLocale(value: string): value is Locale {
  return (supportedLocales as readonly string[]).includes(value);
}

// Picks the first supported language among the preferences, matching the exact tag first and
// then the language alone (`pt-PT` -> `pt-BR`, `es-CO` -> `es`).
export function resolveLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const exact = supportedLocales.find((l) => l.toLowerCase() === preference.toLowerCase());
    if (exact) return exact;
    const language = preference.split('-')[0]?.toLowerCase();
    const sameLanguage = supportedLocales.find((l) => l.split('-')[0]?.toLowerCase() === language);
    if (sameLanguage) return sameLanguage;
  }
  return fallbackLocale;
}
