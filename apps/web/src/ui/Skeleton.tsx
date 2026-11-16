import type { CSSProperties } from 'react';

import styles from './Skeleton.module.css';

interface SkeletonProps {
  shape?: 'text' | 'block' | 'circle';
  width?: string;
  height?: string;
  className?: string | undefined;
}

/*
 * The shape of something that has not arrived yet.
 *
 * It is `aria-hidden`: a screen reader is told about loading once, by the live
 * region of the screen (StatusArea), not by a row of empty boxes.
 */
export function Skeleton({ shape = 'text', width, height, className }: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, styles[shape], className].filter(Boolean).join(' ')}
      style={{ width, height } as CSSProperties}
      aria-hidden="true"
    />
  );
}
