import { useState, type CSSProperties } from 'react';

import styles from './Mascot.module.css';

export type MascotMood = 'happy' | 'sleepy' | 'surprised';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  // Bobs in place: used as the "something is happening" indicator. The mascot
  // always blinks and swings its tail now and then, animated or not.
  animated?: boolean;
  // A one-off entrance: a hop (celebrations) or a shake (something went wrong).
  entrance?: 'hop' | 'shake' | 'none';
  className?: string;
}

/*
 * The mascot slot.
 *
 * P24§3 wants characters built from reusable, code-drawn parts (head, blink,
 * tail, bounce) rather than one flat picture, so the slot is a component and
 * not an <img>: the parts below are the moving pieces, and the colours come
 * from the `--mascot-*` semantic tokens.
 *
 * What is inside it today is the PLACEHOLDER cat of the direction render
 * (docs/agent/designs/c03/direction-a.html), registered as the pending asset
 * `mascot.primary` in assets.json. When the creator supplies or approves the
 * final character (P-15), either this drawing is replaced or the Lottie file is
 * loaded here: every screen asks for the slot, never for the drawing, so
 * nothing else changes. A Lottie character would mount in the same wrapper and
 * obey the same reduced-motion rule.
 *
 * Decorative: `aria-hidden` unless its container gives it a label.
 */
export function Mascot({
  size = 96,
  mood = 'happy',
  animated = false,
  entrance = 'none',
  className,
}: MascotProps) {
  // Each mascot blinks on its own rhythm; two blinking in unison look mechanical.
  const [blinkDelay] = useState(() => `${-Math.random() * 5}s`);
  const wrapper = [
    styles.wrap,
    entrance === 'hop' && 'motion-hop',
    entrance === 'shake' && 'motion-shake',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const eyeRadius = mood === 'surprised' ? 13 : 11;
  return (
    <span className={wrapper} style={{ '--blink-delay': blinkDelay } as CSSProperties}>
      <svg
        className={[styles.mascot, animated && styles.animated].filter(Boolean).join(' ')}
        width={size}
        height={size * (250 / 230)}
        viewBox="0 0 230 250"
        aria-hidden="true"
        focusable="false"
      >
        <g className={styles.tail}>
          <path className={styles.tailLine} d="M150 196 q46 10 44 -34" />
          <path className={styles.tailFill} d="M150 196 q46 10 44 -34" />
        </g>
        <ellipse className={styles.fur} cx="112" cy="190" rx="62" ry="48" />
        <ellipse className={styles.belly} cx="112" cy="206" rx="30" ry="22" />
        <path className={styles.fur} d="M58 70 L48 24 L92 46 Z" />
        <path className={styles.fur} d="M166 70 L176 24 L132 46 Z" />
        <path className={styles.inner} d="M62 60 L57 37 L80 49 Z" />
        <path className={styles.inner} d="M162 60 L167 37 L144 49 Z" />
        <ellipse className={styles.fur} cx="112" cy="102" rx="68" ry="58" />
        {mood === 'sleepy' ? (
          <g className={styles.lids}>
            <path className={styles.line} d="M74 96 q14 12 28 0" />
            <path className={styles.line} d="M124 96 q14 12 28 0" />
          </g>
        ) : (
          <g className={styles.eyes}>
            <circle className={styles.eye} cx="88" cy="96" r={eyeRadius} />
            <circle className={styles.eye} cx="138" cy="96" r={eyeRadius} />
            <circle className={styles.glint} cx="92" cy="92" r="3.6" />
            <circle className={styles.glint} cx="142" cy="92" r="3.6" />
          </g>
        )}
        <path
          className={styles.line}
          d={mood === 'surprised' ? 'M106 120 q6 -8 12 0 q-6 8 -12 0' : 'M106 116 q6 7 12 0'}
        />
        <path className={styles.line} d="M112 112 l0 5" />
        <path className={styles.nose} d="M107 108 q5 -5 10 0 q-5 6 -10 0" />
        <path className={styles.whisker} d="M40 100 l26 2 M42 114 l25 -4" />
        <path className={styles.whisker} d="M184 100 l-26 2 M182 114 l-25 -4" />
        <ellipse className={styles.paw} cx="86" cy="232" rx="17" ry="11" />
        <ellipse className={styles.paw} cx="138" cy="232" rx="17" ry="11" />
      </svg>
    </span>
  );
}
