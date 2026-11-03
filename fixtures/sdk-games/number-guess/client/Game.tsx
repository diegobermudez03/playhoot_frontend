import { Button, Screen, Stack, Text, TextAnswer, useCommand, useView } from '@playhoot/game-react';
import { useState } from 'react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const guess = useCommand(commands.guess);
  const pass = useCommand(commands.pass);
  const [refusal, setRefusal] = useState<string | null>(null);
  if (view === null) return null;

  const myTurn = view.turn === view.me && view.winner === null;
  const send = async (text: string) => {
    const result = await guess({ value: Number(text) });
    setRefusal(result.ok ? null : result.code);
    return result;
  };
  return (
    <Screen theme={{ background: '#1d3557', surface: '#2b4a75' }}>
      <Text size="xl">
        {view.winner === null
          ? `${view.turn === view.me ? 'Your turn' : `${view.turn}'s turn`} · ${view.secondsLeft}s`
          : `${view.winner === view.me ? 'You' : view.winner} found ${view.secret}`}
      </Text>
      <Stack direction="row" align="end">
        <Stack grow>
          <TextAnswer
            label="A number from 1 to 100"
            onSubmit={send}
            submitLabel="Guess"
            disabled={!myTurn}
          />
        </Stack>
        <Button tone="surface" onPress={pass} disabled={!myTurn}>
          Pass
        </Button>
      </Stack>
      {refusal !== null && <Text tone="negative">Refused: {refusal}</Text>}
      <Stack gap="sm">
        {view.guesses.map((entry, index) => (
          <Text key={index}>
            {entry.player}: {entry.value} → {entry.hint}
          </Text>
        ))}
      </Stack>
    </Screen>
  );
}
