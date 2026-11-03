import {
  Choices,
  Countdown,
  Screen,
  Scoreboard,
  Stack,
  Text,
  useCommand,
  usePlayer,
  useView,
} from '@playhoot/game-react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const { id } = usePlayer();
  const answer = useCommand(commands.answer);
  if (view === null || view.phase === null) return null;
  const { phase, question, reveal, subject } = view;
  const name = (player: string) => (player === id ? 'You' : player);

  if (phase.name === 'results') {
    return (
      <Screen theme={{ background: '#3b0d3f', surface: '#5b1f60' }}>
        <Text size="title">Who knows whom best</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  return (
    <Screen theme={{ background: '#3b0d3f', surface: '#5b1f60' }}>
      <Stack direction="row" justify="between">
        <Text tone="muted">{subject === id ? 'About you' : `About ${subject}`}</Text>
        <Countdown />
      </Stack>
      <Text size="xl">{question.text}</Text>
      <Choices
        label={subject === id ? 'Your answer' : `Your guess about ${subject}`}
        options={question.options}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'answer'}
        marks={reveal ? { [reveal.subjectChose]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {reveal
          ? `Guessed right: ${reveal.matched.map(name).join(', ') || 'nobody'}`
          : `${phase.submitted.length} answered`}
      </Text>
    </Screen>
  );
}
