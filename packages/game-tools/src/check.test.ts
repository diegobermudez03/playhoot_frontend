import { describe, expect, it } from 'vitest';

import { checkSource } from './check.ts';

const messages = (file: string, text: string) => checkSource(file, text).map((d) => d.message);

describe('checkSource', () => {
  it('accepts functions, constants and SDK definitions at the top level', () => {
    const text = `
      import { defineGame } from '@playhoot/game-server';
      import { config } from '@playhoot/config/server';
      import { commands } from '../shared/actions';
      const GOAL = 20;
      const ROUNDS = config.rounds;
      const SECONDS = config.timing.seconds;
      const QUESTIONS = [{ q: '2+2', a: 4 }, ...[]];
      type State = { n: number };
      export default defineGame({ players: { min: 1, max: 2 }, commands, setup: (): State => ({ n: 0 }), view: (s) => s });
      function helper(state: State) { const list = []; list.push(state.n); state.n += 1; return list; }
    `;
    expect(messages('server/game.ts', text)).toEqual([]);
  });

  it('refuses state kept between calls', () => {
    const found = messages(
      'server/game.ts',
      `let count = 0;\nvar other = 1;\nconst cache = new Map();\nconst made = make();\nclass A {}`,
    );
    expect(found).toHaveLength(5);
    expect(found[0]).toContain('let/var');
    expect(found[2]).toContain('top-level constants may only hold');
  });

  it('refuses property reads that reach constructors, and computed ones', () => {
    const found = messages(
      'server/game.ts',
      `const A = { a: 1 };
const B = A.constructor;
const C = A['a'];
const D = make().a;`,
    );
    expect(found.filter((m) => m.includes('top-level constants may only hold'))).toHaveLength(3);
  });

  it('refuses enums, top-level statements and reserved names', () => {
    const found = messages(
      'shared/x.ts',
      `enum Phase { A }\nconsole.log(1);\nfunction update() {}`,
    );
    expect(found[0]).toContain('union of strings');
    expect(found[1]).toContain('inside a function');
    expect(found[2]).toContain('reserved');
  });

  it('refuses escapes from the sandbox anywhere', () => {
    const found = messages(
      'server/game.ts',
      `function f(o: any) { eval('1'); globalThis.x; o.constructor; o['__proto__']; }\nasync function g() {}\nfunction* h() {}`,
    );
    expect(found).toHaveLength(6);
  });

  it('keeps server code away from the client and unknown packages away from both', () => {
    expect(messages('client/Game.tsx', `import { x } from '../server/game';`)[0]).toContain(
      'client code cannot import server code',
    );
    expect(messages('server/game.ts', `import React from 'react';`)[0]).toContain('not available');
    expect(messages('shared/a.ts', `import { y } from '../client/Game';`)[0]).toContain(
      'cannot import from client/',
    );
    expect(
      messages('client/Game.tsx', `let free = 1; import { useView } from '@playhoot/game-react';`),
    ).toEqual([]);
    expect(messages('client/Game.tsx', `import { assets } from '@playhoot/assets';`)).toEqual([]);
    expect(messages('server/game.ts', `import { assets } from '@playhoot/assets';`)[0]).toContain(
      'not available',
    );
  });
});
