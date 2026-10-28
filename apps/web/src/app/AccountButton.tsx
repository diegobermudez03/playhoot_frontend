import { useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useLocation } from 'react-router';

import { signInPath, signInRoute } from '../features/paths';
import { Avatar } from '../ui/Avatar';
import styles from './AccountButton.module.css';
import { useAuth, useServices } from './ServicesContext';

// The top bar's corner: who the person is, and the way to sign in or out. Always one 40px control
// so the bar fits a phone; names and actions live in its menu. Signing in continues to the page
// the person was on.
export function AccountButton() {
  const auth = useAuth();
  const intl = useIntl();
  const location = useLocation();
  const { app } = useServices();
  const here = location.pathname + location.search;
  const onSignInPage = location.pathname.startsWith(signInRoute);

  if (auth.status === 'unknown') return null;
  if (auth.status === 'none') {
    if (onSignInPage) return null;
    const label = intl.formatMessage({ id: 'account.signIn' });
    return (
      <Link className={styles.signIn} to={signInPath(here)} aria-label={label}>
        <PersonIcon />
        <span className={styles.signInText}>{label}</span>
      </Link>
    );
  }

  const name = auth.displayName || intl.formatMessage({ id: 'account.unnamed' });
  if (auth.status === 'guest') {
    return (
      <AccountMenu
        name={name}
        kind={intl.formatMessage({ id: 'account.guest' })}
        action={
          onSignInPage ? null : { kind: 'link', to: signInPath(here), label: 'account.signIn' }
        }
      />
    );
  }
  return (
    <AccountMenu
      name={name}
      kind={null}
      action={{ kind: 'button', run: app.signOut, label: 'account.signOut' }}
    />
  );
}

type MenuAction =
  | { kind: 'link'; to: string; label: 'account.signIn' }
  | { kind: 'button'; run: () => void; label: 'account.signOut' };

// A native disclosure: keyboard and screen-reader friendly without extra code.
function AccountMenu({
  name,
  kind,
  action,
}: {
  name: string;
  // What kind of identity it is, when worth saying (a guest).
  kind: string | null;
  action: MenuAction | null;
}) {
  const intl = useIntl();
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={menu} className={styles.menu}>
      <summary
        className={styles.summary}
        aria-label={intl.formatMessage({ id: 'account.menu' }, { name })}
      >
        <Avatar seat={1} label={name} />
      </summary>
      <div className={styles.panel}>
        <p className={styles.who}>
          <span className={styles.name}>{name}</span>
          {kind && <span className={styles.kind}>{kind}</span>}
        </p>
        {action?.kind === 'link' && (
          <Link className={styles.item} to={action.to}>
            <FormattedMessage id={action.label} />
          </Link>
        )}
        {action?.kind === 'button' && (
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              menu.current?.removeAttribute('open');
              action.run();
            }}
          >
            <FormattedMessage id={action.label} />
          </button>
        )}
      </div>
    </details>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
