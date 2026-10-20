import type { CSSProperties } from 'react';

import styles from './Avatar.module.css';

interface AvatarProps {
  // Seat in the room, 1-based: picks the player color.
  seat: number;
  label: string;
  // What the disc shows. Defaults to the label's initial.
  text?: string | undefined;
  highlighted?: boolean;
  size?: 'md' | 'lg';
}

// A player token: a colored disc with an initial.
export function Avatar({ seat, label, text, highlighted = false, size = 'md' }: AvatarProps) {
  const color = `var(--player-${((seat - 1) % 8) + 1})`;
  return (
    <span
      className={[styles.avatar, styles[size], highlighted && styles.highlighted]
        .filter(Boolean)
        .join(' ')}
      style={{ '--avatar-color': color } as CSSProperties}
      aria-hidden="true"
    >
      {text ?? initial(label)}
    </span>
  );
}

function initial(label: string): string {
  const first = [...label.trim()][0];
  return first ? first.toLocaleUpperCase() : '?';
}
