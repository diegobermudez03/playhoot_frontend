import type { CSSProperties } from 'react';

import styles from './Confetti.module.css';

const pieces = 28;

// A one-off burst of confetti in the player colors, for celebrations (a game starting, a win).
// Positions are derived from the index, so the burst is the same every time and needs no state.
export function Confetti() {
  return (
    <div className={styles.burst} aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * 360 + (i % 3) * 7;
        const distance = 120 + ((i * 37) % 90);
        return (
          <span
            key={i}
            className={styles.piece}
            style={
              {
                '--piece-color': `var(--player-${(i % 8) + 1})`,
                '--piece-x': `${Math.cos((angle * Math.PI) / 180) * distance}px`,
                '--piece-y': `${Math.sin((angle * Math.PI) / 180) * distance - 60}px`,
                '--piece-spin': `${(i % 2 ? 1 : -1) * (240 + ((i * 53) % 300))}deg`,
                '--piece-delay': `${(i % 5) * 30}ms`,
                '--piece-shape': i % 3 === 0 ? '50%' : '2px',
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
