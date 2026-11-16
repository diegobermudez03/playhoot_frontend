import type { HTMLAttributes } from 'react';

import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article' | 'li';
  tone?: 'default' | 'flat' | 'accent' | 'highlight';
  // Sticks the card down slightly askew. Decorative.
  tilted?: boolean;
}

export function Card({
  as: Tag = 'section',
  tone = 'default',
  tilted = false,
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        styles.card,
        tone !== 'default' && styles[tone],
        tilted && styles.tilted,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
