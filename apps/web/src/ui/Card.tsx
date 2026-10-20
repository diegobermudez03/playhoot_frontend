import type { HTMLAttributes } from 'react';

import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
  tone?: 'default' | 'raised';
}

export function Card({ as: Tag = 'section', tone = 'default', className, ...rest }: CardProps) {
  return (
    <Tag className={[styles.card, styles[tone], className].filter(Boolean).join(' ')} {...rest} />
  );
}
