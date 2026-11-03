import { useInputs, useView } from '@playhoot/game-react';
import { useEffect } from 'react';

import { ARENA, inputs, type View } from '../shared/actions';

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export default function Game() {
  const view = useView<View>();
  const [, setInputs] = useInputs(inputs);

  // The held arrows become one direction, sent whenever it changes.
  useEffect(() => {
    const held = new Set<string>();
    const send = () => {
      let x = 0;
      let y = 0;
      for (const key of held) {
        x += KEYS[key]?.[0] ?? 0;
        y += KEYS[key]?.[1] ?? 0;
      }
      setInputs({ move: [Math.sign(x), Math.sign(y)] });
    };
    const down = (event: KeyboardEvent) => {
      if (!(event.key in KEYS)) return;
      held.add(event.key);
      send();
    };
    const up = (event: KeyboardEvent) => {
      held.delete(event.key);
      send();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setInputs]);

  if (view === null) return null;
  const at = ([x, y]: [number, number]) => ({
    left: `${(x / ARENA.width) * 100}%`,
    top: `${(y / ARENA.height) * 100}%`,
  });
  return (
    <div style={styles.arena}>
      <div style={{ ...styles.star, ...at(view.star) }} />
      {Object.entries(view.positions).map(([player, position]) => (
        <div
          key={player}
          style={{ ...styles.ship, ...at(position), ...(player === view.me ? styles.mine : {}) }}
        >
          {view.scores[player]}
        </div>
      ))}
      {view.winner && <div style={styles.banner}>{view.winner} wins</div>}
    </div>
  );
}

const styles = {
  arena: { position: 'relative', height: '100%', background: '#0b132b', overflow: 'hidden' },
  star: {
    position: 'absolute',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    borderRadius: '50%',
    background: '#ffd166',
  },
  ship: {
    position: 'absolute',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 16,
    background: '#5bc0be',
    color: '#0b132b',
    font: '800 32px system-ui, sans-serif',
    display: 'grid',
    placeItems: 'center',
  },
  mine: { background: '#ef476f', color: '#fff' },
  banner: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    font: '800 96px system-ui, sans-serif',
  },
} as const;
