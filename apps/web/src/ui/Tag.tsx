import type { ReactNode } from 'react';

import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'accent' | 'info' | 'success' | 'danger' | 'highlight';

interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  // Turns the tag into something that can be taken off (a chosen filter, a tag
  // on a draft). The label is the button's accessible name.
  onRemove?: (() => void) | undefined;
  removeLabel?: string | undefined;
  className?: string | undefined;
}

// A small outlined label on content: a category, a count, a chosen filter.
export function Tag({ tone = 'neutral', children, onRemove, removeLabel, className }: TagProps) {
  return (
    <span
      className={[
        styles.tag,
        tone !== 'neutral' && styles[tone],
        onRemove && styles.removable,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label={removeLabel}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path
              d="M2 2 L10 10 M10 2 L2 10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

// The louder relative of a tag: a statement about the thing beside it
// (live, waiting, blocked), with the system's hard shadow under it.
export function Pill({
  tone = 'accent',
  children,
  className,
}: Omit<TagProps, 'onRemove' | 'removeLabel'>) {
  return (
    <span
      className={[styles.tag, styles.pill, tone !== 'neutral' && styles[tone], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
