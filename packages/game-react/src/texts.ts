// The texts a game shows, in the languages it is written in, and the SDK's own texts in every
// Playhoot language. The language comes from the runtime: the player's when the game declares it,
// else the game's main one.
import type { GameLanguage } from '@playhoot/game-core';
import { useCallback } from 'react';

import { useRuntime } from './runtime';

// A game's texts by language, every language holding the keys of the main (first) one.
export interface Texts<Key extends string = string> {
  readonly languages: readonly [GameLanguage, ...GameLanguage[]];
  readonly texts: Readonly<Partial<Record<GameLanguage, Readonly<Record<Key, string>>>>>;
}

type Others<L extends readonly GameLanguage[]> = L extends readonly [GameLanguage, ...infer Rest]
  ? Rest[number]
  : never;

// The game's texts: `defineTexts(languages, { es: { hello: 'Hola, {name}' }, en: { hello: '…' } })`,
// with `languages` from '@playhoot/project'. The main language's keys are the texts; every other
// declared language must give each of them (a missing one is a type error). `{name}` marks a
// parameter of `t`.
export function defineTexts<
  const L extends readonly [GameLanguage, ...GameLanguage[]],
  const X extends { readonly [K in L[number]]: Readonly<Record<string, string>> },
>(
  languages: L,
  texts: X & NoInfer<{ readonly [K in Others<L>]: { readonly [Key in keyof X[L[0]]]: string } }>,
): Texts<keyof X[L[0]] & string> {
  return { languages, texts: texts as Texts<keyof X[L[0]] & string>['texts'] };
}

// The language this player sees the game in, one of the game's declared languages. Given those
// (`useLanguage(languages)`, from '@playhoot/project') it is typed as one of them, to pick the
// game's own content by language.
export function useLanguage<const L extends readonly [GameLanguage, ...GameLanguage[]]>(
  languages?: L,
): L[number] {
  const { language } = useRuntime();
  return languages === undefined || languages.includes(language) ? language : languages[0];
}

// `t(key, params?)` for the texts of `defineTexts`, in this player's language.
export function useText<Key extends string>(
  texts: Texts<Key>,
): (key: Key, params?: Readonly<Record<string, string | number>>) => string {
  const { language } = useRuntime();
  return useCallback(
    (key, params) => {
      const text = texts.texts[language]?.[key] ?? texts.texts[texts.languages[0]]?.[key] ?? key;
      return fill(text, params);
    },
    [texts, language],
  );
}

function fill(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// The SDK components' own texts, in every Playhoot language.
const sdkTexts: Readonly<Record<GameLanguage, Readonly<Record<SdkText, string>>>> = {
  es: { send: 'Enviar', secondsLeft: 'Quedan {seconds} segundos' },
  en: { send: 'Send', secondsLeft: '{seconds} seconds left' },
  'pt-BR': { send: 'Enviar', secondsLeft: 'Faltam {seconds} segundos' },
};

export type SdkText = 'send' | 'secondsLeft';

// An SDK component's text in this player's language.
export function useSdkText(): (key: SdkText, params?: Readonly<Record<string, number>>) => string {
  const { language } = useRuntime();
  return useCallback((key, params) => fill(sdkTexts[language][key], params), [language]);
}
