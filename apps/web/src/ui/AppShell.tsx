import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Link } from 'react-router';

import { LanguagePicker } from '../i18n/LanguagePicker';
import { SoundToggle } from '../sound/SoundToggle';
import styles from './AppShell.module.css';
import { Logo } from './Logo';
import { Starfield } from './Starfield';

interface AppShellProps {
  children: ReactNode;
  // Hides the top bar logo when the page shows its own big one.
  bare?: boolean;
}

export function AppShell({ children, bare = false }: AppShellProps) {
  const intl = useIntl();
  return (
    <div className={styles.shell}>
      <Starfield />
      <header className={styles.bar}>
        {!bare && (
          <Link
            to="/"
            className={styles.home}
            aria-label={intl.formatMessage({ id: 'app.homeLink' })}
          >
            <Logo />
          </Link>
        )}
        <div className={styles.trailing}>
          <SoundToggle />
          <LanguagePicker />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

// A centered column for focused, single-task screens.
export function Stage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={[styles.stage, wide && styles.wide, 'motion-cascade'].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
