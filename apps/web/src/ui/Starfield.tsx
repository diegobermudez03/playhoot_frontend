import type { CSSProperties } from 'react';

import styles from './Starfield.module.css';

// Fixed positions (percent of the viewport), sizes and twinkle offsets: the same sky every visit.
const stars = [
  [8, 12, 2, 0],
  [22, 6, 1.5, 1.6],
  [37, 18, 1, 0.8],
  [61, 9, 2, 2.4],
  [78, 14, 1.5, 0.3],
  [91, 7, 1, 1.9],
  [14, 38, 1, 2.9],
  [86, 33, 2, 1.1],
  [5, 64, 1.5, 0.5],
  [94, 61, 1, 2.2],
  [18, 86, 2, 1.4],
  [47, 92, 1, 0.1],
  [72, 82, 1.5, 2.7],
  [58, 46, 1, 3.3],
] as const;

// A quiet night sky behind every page: a few stars that twinkle out of step.
export function Starfield() {
  return (
    <div className={styles.sky} aria-hidden="true">
      {stars.map(([x, y, size, delay], i) => (
        <span
          key={i}
          className={styles.star}
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              '--star-size': `${size * 2}px`,
              '--star-delay': `${delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
