import { assets } from '@playhoot/assets';
import {
  AssetImage,
  Button,
  Grid,
  Screen,
  Stack,
  Text,
  useCommand,
  useGameError,
  useGameEvent,
  useView,
} from '@playhoot/game-react';
import { useState } from 'react';

import { commands, type PairError, type PairEvent, type View } from '../shared/actions';

export default function Game() {
  const view = useView<View>();
  const flip = useCommand(commands.flip);
  const [notice, setNotice] = useState('');
  useGameEvent<PairEvent>((event) =>
    setNotice(event.kind === 'match' ? `${event.player} found a pair!` : `${event.player} missed`),
  );
  useGameError<PairError>(() => setNotice('Wait for your turn'));
  if (view === null) return null;

  return (
    <Screen theme={{ background: '#1d3557' }}>
      <Stack direction="row" justify="between">
        <Text>{view.winner ? `Winner: ${view.winner}` : `Turn: ${view.turn ?? '-'}`}</Text>
        <Text tone="accent">{notice}</Text>
      </Stack>
      <Grid columns={4}>
        {view.cards.map((card, index) => (
          <Button
            key={index}
            tone={card.state === 'matched' ? 'positive' : 'surface'}
            label={card.symbol ?? `Card ${index + 1}`}
            disabled={card.state !== 'hidden' || view.turn !== view.me}
            onPress={() => flip({ index })}
            style={{ height: '32vmin', padding: 0, overflow: 'hidden', fontSize: '10vmin' }}
          >
            {card.state !== 'hidden' ? (
              card.symbol
            ) : (
              <AssetImage
                asset={assets.cardBack}
                alt=""
                fit="cover"
                fallback={<Text tone="accent">?</Text>}
              />
            )}
          </Button>
        ))}
      </Grid>
    </Screen>
  );
}
