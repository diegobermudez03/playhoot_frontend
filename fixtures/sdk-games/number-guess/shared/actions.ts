import { defineCommands } from '@playhoot/game-core';

// What players may ask the server to do, and the fields each request carries.
export const commands = defineCommands({
  guess: { value: { type: 'number', min: 1, max: 100 } },
  pass: {},
});

// What one player sees. The secret is null until the game ends.
export type View = {
  me: string;
  turn: string | null;
  secondsLeft: number;
  guesses: { player: string; value: number; hint: 'higher' | 'lower' | 'correct' }[];
  winner: string | null;
  secret: number | null;
};
