import type { ReactNode } from 'react';

import { Owl, type OwlMood } from '../ui';
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
  mood?: OwlMood;
  children?: ReactNode;
}) {
  return (
    <div className={styles.notice}>
      <Owl size={104} mood={mood} />
      <h1 className={styles.title}>{title}</h1>
      {body && <p className={styles.body}>{body}</p>}
      {children}
    </div>
  );
}
