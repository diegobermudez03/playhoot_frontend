// The questions players read, in each language the game is written in. Public: the client shows
// them, so the right answers live only in server/game.ts.
export const QUESTIONS = {
  es: [
    { text: '¿Cuánto es 7 x 8?', options: ['54', '56', '64', '48'] },
    { text: '¿Qué planeta es el más grande?', options: ['Marte', 'Tierra', 'Júpiter', 'Venus'] },
    { text: '¿Cuántos lados tiene un hexágono?', options: ['5', '6', '7', '8'] },
  ],
  en: [
    { text: 'What is 7 x 8?', options: ['54', '56', '64', '48'] },
    { text: 'Which planet is the largest?', options: ['Mars', 'Earth', 'Jupiter', 'Venus'] },
    { text: 'How many sides has a hexagon?', options: ['5', '6', '7', '8'] },
  ],
};
