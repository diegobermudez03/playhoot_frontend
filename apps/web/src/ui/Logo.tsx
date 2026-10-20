import styles from './Logo.module.css';
import { Owl } from './Owl';

// The brand name is the same in every language, so it is not a translatable message.
const wordmark = { start: 'play', end: 'hoot' } as const;

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <Owl size={size === 'lg' ? 72 : 36} />
      <span className={styles.word}>
        {wordmark.start}
        <span className={styles.hoot}>{wordmark.end}</span>
      </span>
    </span>
  );
}
