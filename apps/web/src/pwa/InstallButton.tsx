import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { usePwa } from './PwaContext';
import styles from './InstallButton.module.css';

// "Install Playhoot", always there while the browser can do it — the offer that does not depend
// on the one-time hint (V-08). It lives in the top bar until T-204 builds the shell's menu.
// On Apple's browsers no page can install the app, so the entry opens the line that says how,
// in place, without taking focus away from anything.
export function InstallButton() {
  const pwa = usePwa();
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  if (!pwa || pwa.install === 'unavailable') return null;
  const label = intl.formatMessage({ id: 'pwa.install' });

  if (pwa.install === 'instructions') {
    return (
      <details
        className={styles.steps}
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className={styles.button} aria-label={label}>
          <InstallIcon />
          <span className={styles.label}>{label}</span>
        </summary>
        <p className={styles.panel}>
          <FormattedMessage id="pwa.hint.appleSteps" />
        </p>
      </details>
    );
  }

  return (
    <button type="button" className={styles.button} aria-label={label} onClick={pwa.promptInstall}>
      <InstallIcon />
      <span className={styles.label}>{label}</span>
    </button>
  );
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.icon}>
      <path d="M12 3v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 18.5h15" />
    </svg>
  );
}
