import { useEffect, useState, type ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, NavLink } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import { Button } from '../../ui';
import { adminPaths } from '../paths';
import styles from './Admin.module.css';

// The admin area's own frame (D-023): plain, functional, desktop first and responsive down to a
// phone. Nothing of the public shell appears here, and nothing here is linked from it.
export function AdminShell({ children }: { children: ReactNode }) {
  const intl = useIntl();
  return (
    <div className={styles.area}>
      <a className={styles.skip} href={`#${adminMainId}`}>
        <FormattedMessage id="shell.skipToContent" />
      </a>
      <header className={styles.bar}>
        <Link to={adminPaths.home} className={styles.brand}>
          <FormattedMessage id="admin.title" />
        </Link>
        <nav className={styles.nav} aria-label={intl.formatMessage({ id: 'admin.nav.label' })}>
          <AdminLink to={adminPaths.home} messageId="admin.nav.overview" end />
          <AdminLink to={adminPaths.queues} messageId="admin.nav.queues" />
          <AdminLink to={adminPaths.budget} messageId="admin.nav.budget" />
          <AdminLink to={adminPaths.email} messageId="admin.nav.email" />
          <AdminLink to={adminPaths.secondFactor} messageId="admin.nav.secondFactor" />
        </nav>
        <AdminIdentity />
      </header>
      <main id={adminMainId} className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

const adminMainId = 'admin-main';

// The frame of the two screens that come before admin mode: the same page, without a navigation
// that would lead nowhere.
export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.area}>
      <header className={styles.bar}>
        <span className={styles.brand}>
          <FormattedMessage id="admin.title" />
        </span>
      </header>
      <main id={adminMainId} className={`${styles.main} ${styles.narrow}`} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

function AdminLink({
  to,
  messageId,
  end = false,
}: {
  to: string;
  messageId: MessageId;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [styles.navLink, isActive && styles.navActive].filter(Boolean).join(' ')
      }
    >
      <FormattedMessage id={messageId} />
    </NavLink>
  );
}

// Who is in admin mode, how long it lasts, and the way out of it.
function AdminIdentity() {
  const { adminSession, app } = useServices();
  const session = useStore(adminSession.store);
  const auth = useStore(app.store, (state) => state.auth);
  const remaining = useRemainingMinutes(session.expiresAt);
  const name = auth.status === 'authenticated' ? auth.displayName : null;
  return (
    <div className={styles.identity}>
      <span className={styles.who}>
        <FormattedMessage id="admin.signedInAs" values={{ name: name ?? '' }} />
        {remaining !== null && (
          <span className={styles.remaining}>
            <FormattedMessage id="admin.sessionRemaining" values={{ minutes: remaining }} />
          </span>
        )}
      </span>
      <Button variant="ghost" size="sm" onClick={adminSession.release}>
        <FormattedMessage id="admin.leave" />
      </Button>
    </div>
  );
}

// Whole minutes left of admin mode, counted down every half minute. Only ever rendered in the
// browser (the admin area is client-only), so there is no server render to disagree with.
function useRemainingMinutes(expiresAt: number | null): number | null {
  // The clock is the only thing that changes; the minutes left are worked out while rendering,
  // so nothing is written to state from inside an effect.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 60_000));
}
