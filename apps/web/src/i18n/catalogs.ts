import type { Locale } from '@playhoot/app-core';

import { en, type Messages } from './messages/en';
import { es } from './messages/es';
import { ptBR } from './messages/pt-BR';

export type { MessageId, Messages } from './messages/en';

export const catalogs: Record<Locale, Messages> = { es, en, 'pt-BR': ptBR };

// Each language named in itself, so people find their own language in the picker.
export const languageNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  'pt-BR': 'Português',
};

export const sourceCatalog = en;
