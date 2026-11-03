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
  const { phase, question, reveal } = view;
  const name = (player: string) => (player === id ? 'You' : player);

  if (phase.name === 'results' || question === null) {
    return (
      <Screen>
        <Text size="title">Final ranking</Text>
        <Scoreboard standings={view.standings} name={name} />
      </Screen>
    );
  }
  const points = view.standings.find((s) => s.player === id)?.points ?? 0;
  return (
    <Screen>
      <Stack direction="row" justify="between">
        <Text tone="muted">
          Question {question.number}/{view.total}
        </Text>
        <Countdown />
      </Stack>
      <Text size="xl">{question.text}</Text>
      <Choices
        label="Your answer"
        options={question.options.map((text, i) =>
          reveal ? `${text} (${reveal.counts[i]})` : text,
        )}
        value={phase.mine?.option ?? null}
        onChange={(option) => answer({ option })}
        disabled={phase.name !== 'question'}
        marks={reveal ? { [reveal.correct]: 'correct' } : undefined}
      />
      <Text tone="muted">
        {phase.name === 'question' ? `${phase.submitted.length} answered` : `Score: ${points}`}
      </Text>
    </Screen>
  );
}
