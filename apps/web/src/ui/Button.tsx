import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { useSound, type SoundId } from '../sound';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  // Played on click. Defaults to a soft tap; null for none.
  sound?: SoundId | null;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  sound = 'tap',
  onClick,
  ...rest
}: ButtonProps) {
  const player = useSound();
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    block && styles.block,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (sound) player.play(sound);
        onClick?.(event);
      }}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
