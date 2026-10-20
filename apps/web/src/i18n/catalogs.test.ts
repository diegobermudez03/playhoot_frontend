import {
  isArgumentElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { catalogs, sourceCatalog } from './catalogs';

// The names a message needs from the code ({seat}) and the tags it uses (<b>). A translation
// must use exactly the same ones, in whatever order its language needs.
function signature(message: string): string[] {
  const found = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (isArgumentElement(element)) found.add(`{${element.value}}`);
      if (isPluralElement(element) || isSelectElement(element)) {
        found.add(`{${element.value}}`);
        Object.values(element.options).forEach((option) => walk(option.value));
      }
      if (isTagElement(element)) {
        found.add(`<${element.value}>`);
        walk(element.children);
      }
    }
  };
  walk(parse(message));
  return [...found].sort();
}

describe('message catalogs', () => {
  const ids = Object.keys(sourceCatalog).sort();

  it.each(Object.entries(catalogs))('%s has exactly the source ids', (_, messages) => {
    expect(Object.keys(messages).sort()).toEqual(ids);
  });

  it.each(Object.entries(catalogs))(
    '%s messages are valid ICU with the source placeholders and tags',
    (_, messages) => {
      for (const id of ids) {
        const key = id as keyof typeof sourceCatalog;
        expect([id, signature(messages[key])]).toEqual([id, signature(sourceCatalog[key])]);
      }
    },
  );
});
