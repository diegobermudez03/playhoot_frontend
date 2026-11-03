import { defineInputs } from '@playhoot/game-core';

// The arena's size in world units; the client scales it to the screen.
export const ARENA = { width: 160, height: 90 };

// Each player holds a direction; the server moves them while they hold it.
export const inputs = defineInputs({
  move: 'vector2',
});

export type View = {
  me: string;
  positions: Record<string, [number, number]>;
  star: [number, number];
  scores: Record<string, number>;
  winner: string | null;
};
