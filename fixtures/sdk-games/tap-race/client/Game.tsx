import { Button, Screen, Stack, Text, useCommand, usePlayer, useView } from '@playhoot/game-react';

import { commands, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const { players } = usePlayer();
  const tap = useCommand(commands.tap);
  if (view === null) return null;

  const done = view.winner !== null;
  return (
    <Screen theme={{ background: '#14213d', accent: '#fca311' }}>
      <Stack direction="row" justify="between">
        <Text>Goal: {view.goal}</Text>
        <Text>{done ? 'Finished' : `${view.secondsLeft}s`}</Text>
      </Stack>
      <Stack direction="row" grow>
        <Button onPress={tap} disabled={done} style={{ flex: 2, fontSize: '15vmin' }}>
          {done ? (view.winner === view.me ? 'You win!' : 'Game over') : (view.taps[view.me] ?? 0)}
        </Button>
        <Stack gap="sm" style={{ flex: 1 }}>
          {players.map((player) => (
            <Text key={player} tone={player === view.me ? 'accent' : undefined}>
              {player === view.me ? 'You' : player}: {view.taps[player] ?? 0}
              {view.winner === player ? ' 🏆' : ''}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Screen>
  );
}
