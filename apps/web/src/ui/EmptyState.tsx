import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';
import { Mascot, type MascotMood } from './Mascot';

interface EmptyStateProps {
  title: string;
  body?: string;
  mood?: MascotMood;
  // Hides the mascot where the empty state sits inside something small.
  bare?: boolean;
  actions?: ReactNode;
  className?: string | undefined;
}

// A list, a search or a section with nothing in it: say so, and offer the way
// out. Never an error — the error tone belongs to Status.
export function EmptyState({
  title,
  body,
  mood = 'sleepy',
  bare = false,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div className={[styles.empty, className].filter(Boolean).join(' ')}>
      {!bare && <Mascot size={96} mood={mood} />}
      <h2 className={styles.title}>{title}</h2>
      {body && <p className={styles.body}>{body}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
