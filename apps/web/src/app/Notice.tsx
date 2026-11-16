import type { ReactNode } from 'react';

import { Mascot, type MascotMood } from '../ui';
import styles from './Notice.module.css';

// A full-screen message with the owl: not found, errors.
export function Notice({
  title,
  body,
  mood = 'surprised',
  children,
}: {
  title: ReactNode;
  body: ReactNode;
  mood?: MascotMood;
  children?: ReactNode;
}) {
  return (
    <div className={styles.notice}>
      <Mascot size={104} mood={mood} />
      <h1 className={styles.title}>{title}</h1>
      {body && <p className={styles.body}>{body}</p>}
      {children}
    </div>
  );
}
