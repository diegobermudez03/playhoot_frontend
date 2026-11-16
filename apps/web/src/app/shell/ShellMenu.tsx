import { useRef, type ReactNode } from 'react';
import { useIntl } from 'react-intl';

import { LanguagePicker } from '../../i18n/LanguagePicker';
import { SoundToggle } from '../../sound/SoundToggle';
import { ClientOnly } from '../ClientOnly';
import { InstallButton, usePwa } from '../../pwa';
import { ModeChoice } from './ModeChoice';
import styles from './ShellMenu.module.css';

// The bar's overflow, as a native disclosure: keyboard and screen reader friendly without extra
// code. Narrow displays have no room for every entry at once, so the ones the bar drops are here
// instead — and the offer to install the app lives here whatever the width, where it does not
// compete with what the person came to do (D-020, V-08).
export function ShellMenu({ children }: { children?: ReactNode }) {
  const intl = useIntl();
  const pwa = usePwa();
  const menu = useRef<HTMLDetailsElement>(null);
  // Once the bar itself shows the entries, the only thing left here is the install offer: without
  // it the menu would open on nothing, so it is not there at all.
  const installable = pwa !== null && pwa.install !== 'unavailable';
  return (
    <details
      className={[styles.menu, !installable && styles.narrowOnlyMenu].filter(Boolean).join(' ')}
      ref={menu}
    >
      <summary className={styles.summary} aria-label={intl.formatMessage({ id: 'shell.menu' })}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={styles.icon}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <div className={styles.panel}>
        {/* Join and create: in the bar itself once there is room for them. */}
        <div className={styles.narrowOnly} onClick={() => menu.current?.removeAttribute('open')}>
          {children}
        </div>
        {/* The mode switch stays in the bar on every phone held upright; only the narrowest
            displays (320 px) have to find it here. */}
        <div className={styles.tinyOnly}>
          <ModeChoice className={styles.modes} />
        </div>
        <div className={styles.narrowOnly}>
          <LanguagePicker />
          <SoundToggle />
        </div>
        <ClientOnly>
          <InstallButton />
        </ClientOnly>
      </div>
    </details>
  );
}
