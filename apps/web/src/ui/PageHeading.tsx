import type { ReactNode } from 'react';

import styles from './PageHeading.module.css';
import { Tag } from './Tag';

interface PageHeadingProps {
  title: string;
  // One line above the title: what kind of screen this is.
  kicker?: string;
  // One line below it: what the person can do here.
  lead?: string;
  actions?: ReactNode;
  // `h1` on a screen, `h2` for a section inside one.
  level?: 1 | 2;
  className?: string | undefined;
}

// The heading block every screen opens with, so headings keep one order and
// one shape across the app (WCAG 2.4.6).
export function PageHeading({
  title,
  kicker,
  lead,
  actions,
  level = 1,
  className,
}: PageHeadingProps) {
  const Title = level === 1 ? 'h1' : 'h2';
  return (
    <div className={[styles.heading, className].filter(Boolean).join(' ')}>
      <div className={styles.texts}>
        {kicker && (
          <Tag tone="highlight" className={styles.kicker}>
            {kicker}
          </Tag>
        )}
        <Title className={styles.title}>{title}</Title>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
