import { defineCommands } from '@playhoot/game-core';

export const CARDS = 8;

export const commands = defineCommands({
  flip: { index: { type: 'number', min: 0, max: 7 } },
});

// A card as one player sees it: its symbol only once it is face up or matched.
export type CardView = { state: 'hidden' | 'open' | 'matched'; symbol: string | null };

export type View = {
  me: string;
  turn: string | null;
  cards: CardView[];
  scores: Record<string, number>;
  winner: string | null;
};

// What emit() sends everyone after a second card is turned.
export type PairEvent = { kind: 'match' | 'miss'; player: string };

// What error() sends a player who flips out of turn.
export type PairError = { code: 'not_your_turn' };
