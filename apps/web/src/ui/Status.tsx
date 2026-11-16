import type { ReactNode } from 'react';

import styles from './Status.module.css';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// The mark is the non-colour half of the tone (WCAG 1.4.1): the same five
// shapes everywhere, so a tone is recognisable without seeing its fill.
const marks: Record<StatusTone, string> = {
  neutral: '·',
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '×',
};

interface StatusProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string | undefined;
}

// One short message about what just happened, next to its mark.
export function Status({ tone = 'neutral', children, className }: StatusProps) {
  return (
    <div
      className={[styles.status, tone !== 'neutral' && styles[tone], className]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.mark} aria-hidden="true">
        {marks[tone]}
      </span>
      <span className={styles.text}>{children}</span>
    </div>
  );
}

/*
 * The place on a screen where results of an action appear. It is a live region
 * that is always mounted and always takes its space: an assistive technology
 * hears the change, and a sighted person sees no jump. `assertive` only for
 * something that interrupts what the person is doing.
 */
export function StatusArea({
  children,
  urgent = false,
  className,
}: {
  children?: ReactNode;
  urgent?: boolean;
  className?: string | undefined;
}) {
  return (
    <div
      className={[styles.area, className].filter(Boolean).join(' ')}
      role="status"
      aria-live={urgent ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}

// The floating version of the same thing, for what happens away from where the
// person is looking. The list is owned by whoever renders it.
export function ToastStack({ children }: { children: ReactNode }) {
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {children}
    </div>
  );
}
