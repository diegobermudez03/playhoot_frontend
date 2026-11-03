import { defineCommands, type PhaseView, type Standing } from '@playhoot/game-core';

// `phase` makes an answer sent for an earlier question arrive as STALE_PHASE instead of counting
// for the current one; useCommand fills it in.
export const commands = defineCommands({
  answer: { option: { type: 'number', min: 0, max: 3 }, phase: 'number' },
});

export type View = {
  // Which question is asked (1-based); its text is in shared/questions.ts, in the player's language.
  question: { number: number } | null;
  // Shown only once the question ended.
  reveal: { correct: number; counts: number[] } | null;
  standings: Standing[];
  total: number;
  phase: PhaseView<'question' | 'reveal' | 'results', { option: number }> | null;
};
