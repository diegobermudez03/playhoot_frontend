import { describe, expect, it } from 'vitest';

import { inputRequirements } from './inputs.ts';

const read = (text: string) => inputRequirements([{ file: 'client/Game.tsx', text }]);

describe('inputRequirements', () => {
  it('counts the SDK controls only as pressing, whatever keyboard they also accept', () => {
    expect(
      read(`import { Button, Choices as Pick } from '@playhoot/game-react';
        export default () => <><Button onPress={go}>Go</Button><Pick label="x" options={[]} value={null} onChange={f} /></>;`),
    ).toEqual({ usesKeyboard: false, usesPointerHover: false, usesPointerPress: true });
  });

  it('counts raw keyboard listeners and JSX key handlers as needing a keyboard', () => {
    expect(read(`window.addEventListener('keydown', down);`).usesKeyboard).toBe(true);
    expect(read(`export default () => <div onKeyDown={f} />;`).usesKeyboard).toBe(true);
  });

  it('counts hover and press handlers', () => {
    expect(read(`export default () => <div onMouseEnter={f} onClick={g} />;`)).toEqual({
      usesKeyboard: false,
      usesPointerHover: true,
      usesPointerPress: true,
    });
  });

  it('asks nothing of a client that only shows the view', () => {
    expect(read(`export default () => <p>hi</p>;`)).toEqual({
      usesKeyboard: false,
      usesPointerHover: false,
      usesPointerPress: false,
    });
  });
});
