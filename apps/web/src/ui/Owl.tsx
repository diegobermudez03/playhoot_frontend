import { useState, type CSSProperties } from 'react';

import styles from './Owl.module.css';

export type OwlMood = 'happy' | 'sleepy' | 'surprised';

interface OwlProps {
  size?: number;
  mood?: OwlMood;
  // Bobs gently: used as the loading indicator. The owl always blinks now and then.
  animated?: boolean;
  // A one-off entrance: a happy hop (celebrations) or a shake (something went wrong).
  entrance?: 'hop' | 'shake' | 'none';
  className?: string;
}

// Hoot, the Playhoot owl. Decorative unless given a label by its container.
export function Owl({
  size = 64,
  mood = 'happy',
  animated = false,
  entrance = 'none',
  className,
}: OwlProps) {
  // Each owl blinks on its own rhythm; owls blinking in unison look mechanical.
  const [blinkDelay] = useState(() => `${-Math.random() * 5}s`);
  const classes = [styles.owl, animated && styles.animated].filter(Boolean).join(' ');
  const wrapper = [
    styles.wrap,
    entrance === 'hop' && 'motion-hop',
    entrance === 'shake' && 'motion-shake',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={wrapper}>
      <svg
        className={classes}
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
        style={{ '--blink-delay': blinkDelay } as CSSProperties}
      >
        <path className={styles.tuft} d="M13 21 L10 5 L25 13 Z" />
        <path className={styles.tuft} d="M51 21 L54 5 L39 13 Z" />
        <path
          className={styles.body}
          d="M11 28 C11 14 19 9 32 9 C45 9 53 14 53 28 V44 C53 55 44 60 32 60 C20 60 11 55 11 44 Z"
        />
        <ellipse className={styles.belly} cx="32" cy="50" rx="13" ry="8" />
        <g className={styles.eyes}>
          <circle className={styles.eyeRing} cx="22.5" cy="29" r="10" />
          <circle className={styles.eyeRing} cx="41.5" cy="29" r="10" />
          <circle className={styles.iris} cx="22.5" cy="29" r="8" />
          <circle className={styles.iris} cx="41.5" cy="29" r="8" />
          {mood === 'sleepy' ? (
            <>
              <path className={styles.lid} d="M14.5 29 Q22.5 35 30.5 29" />
              <path className={styles.lid} d="M33.5 29 Q41.5 35 49.5 29" />
            </>
          ) : (
            <>
              <circle
                className={styles.pupil}
                cx="23.5"
                cy="30"
                r={mood === 'surprised' ? 2.6 : 3.8}
              />
              <circle
                className={styles.pupil}
                cx="40.5"
                cy="30"
                r={mood === 'surprised' ? 2.6 : 3.8}
              />
              <circle className={styles.glint} cx="25" cy="28" r="1.3" />
              <circle className={styles.glint} cx="42" cy="28" r="1.3" />
            </>
          )}
        </g>
        {mood === 'surprised' ? (
          <ellipse className={styles.beak} cx="32" cy="42" rx="3" ry="3.6" />
        ) : (
          <path className={styles.beak} d="M28.5 39 L35.5 39 L32 44.5 Z" />
        )}
      </svg>
    </span>
  );
}
