import { defineCommands, type PhaseView, type Standing } from '@playhoot/game-core';

export const commands = defineCommands({
  answer: { option: { type: 'number', min: 0, max: 3 }, phase: 'number' },
});

export type View = {
  // Whose round it is: they answer about themselves, everyone else guesses.
  subject: string;
  question: { text: string; options: string[] };
  reveal: { subjectChose: number; matched: string[] } | null;
  standings: Standing[];
  phase: PhaseView<'answer' | 'reveal' | 'results', { option: number }> | null;
};
