import {
  Choices,
  Countdown,
  defineTexts,
  Screen,
  Scoreboard,
  Stack,
  Text,
  useCommand,
  useLanguage,
  usePlayer,
  useText,
  useView,
} from '@playhoot/game-react';
import { config } from '@playhoot/config';
import { languages } from '@playhoot/project';

import { commands, type View } from '../shared/actions';

const texts = defineTexts(languages, {
  es: {
    question: 'Pregunta {number}/{total}',
    yourAnswer: 'Tu respuesta',
    answered: '{count} respondieron',
    score: 'Puntaje: {points}',
    ranking: 'Ranking final',
    you: 'Tú',
  },
  en: {
    question: 'Question {number}/{total}',
    yourAnswer: 'Your answer',
    answered: '{count} answered',
    score: 'Score: {points}',
    ranking: 'Final ranking',
    you: 'You',
  },
});

export default function Game() {
  const view = useView<View>();
  const { id } = usePlayer();
  const t = useText(texts);
  const language = useLanguage(languages);
  const answer = useCommand(commands.answer);
  if (view === null || view.phase === null) return null;
  const { phase, question, reveal } = view;
  const name = (player: string) => (player === id ? t('you') : player);

  if (phase.name === 'results' || question === null) {
    return (
      <Screen>
        <Text size="title">{t('ranking')}</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  // The question's public part: its text and options (which one is right stays on the server).
  const { text, options } = config.questions[question.number - 1];
  const points = view.standings.find((s) => s.player === id)?.points ?? 0;
  return (
    <Screen>
      <Stack direction="row" justify="between">
        <Text tone="muted">{t('question', { number: question.number, total: view.total })}</Text>
        <Countdown />
      </Stack>
      <Text size="xl">{text[language]}</Text>
      <Choices
        label={t('yourAnswer')}
        options={options.map((option, i) =>
          reveal ? `${option[language]} (${reveal.counts[i]})` : option[language],
        )}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'question'}
        marks={reveal ? { [reveal.correct]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {phase.name === 'question'
          ? t('answered', { count: phase.submitted.length })
          : t('score', { points })}
      </Text>
    </Screen>
  );
}
