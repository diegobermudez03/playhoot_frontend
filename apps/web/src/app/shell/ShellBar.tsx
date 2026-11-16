import { useIntl } from 'react-intl';
import { Link } from 'react-router';

import { newGamePath } from '../../features/paths';
import { LanguagePicker } from '../../i18n/LanguagePicker';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { SoundToggle } from '../../sound/SoundToggle';
import { Logo } from '../../ui';
import { AccountButton } from '../AccountButton';
import { ModeChoice } from './ModeChoice';
import { NotificationsBell } from './NotificationsBell';
import { ShellMenu } from './ShellMenu';
import styles from './ShellBar.module.css';

// The fixed top bar of every non-admin screen (P14§1, B: search): the way home, joining a
// session, creating a game, the three modes, notifications, the language and who the person is.
// It is rendered once above the router, so navigating never rebuilds it.
//
// What it shows at a given width is decided in CSS, not here: the bar is server-rendered before
// anything is known about the display, and a bar that rearranged itself after hydration would
// move under the reader's pointer. Entries the width cannot hold are in the menu instead.
export function ShellBar({ bare = false }: { bare?: boolean }) {
  const intl = useIntl();
  const paths = useLocalePaths();
  const entries = (
    <>
      <Link className={styles.entry} to={paths.enterCode}>
        {intl.formatMessage({ id: 'shell.join' })}
      </Link>
      {/* The create route asks for the account it needs and comes back (features/access.tsx). */}
      <Link className={styles.entryStrong} to={newGamePath}>
        {intl.formatMessage({ id: 'shell.create' })}
      </Link>
    </>
  );
  return (
    <header className={styles.bar}>
      {!bare && (
        <Link
          to={paths.home}
          className={styles.home}
          aria-label={intl.formatMessage({ id: 'app.homeLink' })}
        >
          <Logo />
        </Link>
      )}
      <nav className={styles.entries} aria-label={intl.formatMessage({ id: 'shell.nav' })}>
        {entries}
      </nav>
      <ModeChoice className={styles.modes} size="sm" />
      <div className={styles.trailing}>
        <NotificationsBell />
        <div className={styles.wideOnly}>
          <LanguagePicker />
          <SoundToggle />
        </div>
        <AccountButton />
        <ShellMenu>{entries}</ShellMenu>
      </div>
    </header>
  );
}
