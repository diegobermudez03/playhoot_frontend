import '@fontsource/roboto/500.css';

import type { ReactNode } from 'react';

import { assetPath } from '../../assets';
import styles from './GoogleButton.module.css';

// Google's own sign-in button (its branding guidelines, dark theme, pill shape): the unmodified
// "G" mark, Roboto Medium, Google's colors. It is not themed like the rest of the app on purpose.
export function GoogleButton({
  children,
  disabled,
  busy,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      <img className={styles.mark} src={assetPath('brand.google-g')} alt="" aria-hidden />
      <span className={styles.label}>{children}</span>
    </button>
  );
}
