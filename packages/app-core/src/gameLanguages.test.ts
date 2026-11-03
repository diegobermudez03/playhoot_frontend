import { gameLanguages } from '@playhoot/game-core';
import { describe, expect, it } from 'vitest';

import { supportedLocales } from './locale';

describe('game languages', () => {
  it('are the languages Playhoot is offered in', () => {
    // Games may be written in any language the platform speaks, and the SDK's own texts come in
    // all of them: adding a platform language means adding it to both lists.
    expect([...gameLanguages]).toEqual([...supportedLocales]);
  });
});
