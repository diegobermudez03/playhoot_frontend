import styles from './Logo.module.css';

// The brand name is the same in every language, so it is not a translatable message.
const wordmark = { start: 'play', end: 'hoot' } as const;

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <span className={styles.mark} aria-hidden="true">
        <svg
          width={size === 'lg' ? 28 : 16}
          height={size === 'lg' ? 28 : 16}
          viewBox="0 0 16 16"
          focusable="false"
        >
          <path d="M4 2.5 L13 8 L4 13.5 Z" fill="currentColor" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.word}>
        {wordmark.start}
        <span className={styles.hoot}>{wordmark.end}</span>
      </span>
    </span>
  );
}
