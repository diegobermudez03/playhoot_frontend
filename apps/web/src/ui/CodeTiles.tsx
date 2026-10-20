import type { CSSProperties } from 'react';

import styles from './CodeTiles.module.css';

interface CodeTilesProps {
  code: string;
  length?: number;
  // Index of the tile awaiting input, when used as an input.
  activeIndex?: number | null;
  size?: 'md' | 'lg';
}

// A join code as letter tiles, like pieces of a word game.
export function CodeTiles({
  code,
  length = code.length,
  activeIndex = null,
  size = 'md',
}: CodeTilesProps) {
  const chars = Array.from({ length }, (_, i) => code[i] ?? '');
  return (
    <span className={`${styles.tiles} ${styles[size]}`} aria-hidden="true">
      {chars.map((char, i) => (
        <span
          key={i}
          className={[
            styles.tile,
            char && styles.filled,
            char && 'motion-pop',
            activeIndex === i && styles.active,
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ '--motion-index': i } as CSSProperties}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
