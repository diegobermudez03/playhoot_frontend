import { useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useLocation } from 'react-router';

import { aiConnectionsPath, authRoute, myGamesPath, profilePaths } from '../features/paths';
import { publicPathOf } from '../i18n/localePaths';
import { useLocalePaths } from '../i18n/useLocalePaths';
import { Avatar } from '../ui/Avatar';
import styles from './AccountButton.module.css';
import { useAuth, useOptionalServices, useServices } from './ServicesContext';

// The top bar's corner: who the person is, and the way to sign in or out. Always one 40px control
// so the bar fits a phone; names and actions live in its menu. Signing in continues to the page
// the person was on.
// The server renders the shell of a public page before the app exists; who the person is is only
// known in the browser, so the corner stays empty until then.
export function AccountButton() {
  return useOptionalServices() ? <AccountButtonInner /> : null;
}

function AccountButtonInner() {
  const auth = useAuth();
  const intl = useIntl();
  const location = useLocation();
  const { app } = useServices();
  const paths = useLocalePaths();
  const here = location.pathname + location.search;
  // The same page in any language: `/es/sign-in` is the authentication screen just as
  // `/sign-in` is.
  const onSignInPage = (publicPathOf(location.pathname) ?? location.pathname).startsWith(authRoute);

  if (auth.status === 'unknown') return null;
  if (auth.status === 'none') {
    if (onSignInPage) return null;
    const label = intl.formatMessage({ id: 'account.signIn' });
    return (
      <Link className={styles.signIn} to={paths.auth({ next: here })} aria-label={label}>
        <PersonIcon />
        <span className={styles.signInText}>{label}</span>
      </Link>
    );
  }

  const name = auth.displayName || intl.formatMessage({ id: 'account.unnamed' });
  // A guest has a corner of their own too: their name, what a guest is, and the way out of it.
  if (auth.status === 'guest') {
    return (
      <AccountMenu
        name={name}
        kind={intl.formatMessage({ id: 'account.guest' })}
        links={[{ to: profilePaths.home, label: 'account.profile' }]}
        action={
          onSignInPage
            ? null
            : { kind: 'link', to: paths.auth({ next: here }), label: 'account.signIn' }
        }
        secondary={{ run: app.signOut, label: 'account.signOut' }}
      />
    );
  }
  return (
    <AccountMenu
      name={name}
      kind={null}
      links={[
        { to: profilePaths.home, label: 'account.profile' },
        { to: myGamesPath, label: 'account.myGames' },
        { to: aiConnectionsPath, label: 'account.aiConnections' },
      ]}
      action={{ kind: 'button', run: app.signOut, label: 'account.signOut' }}
    />
  );
}

type MenuAction =
  | { kind: 'link'; to: string; label: 'account.signIn' }
  | { kind: 'button'; run: () => void; label: 'account.signOut' };

type MenuLinkLabel = 'account.profile' | 'account.myGames' | 'account.aiConnections';

// A native disclosure: keyboard and screen-reader friendly without extra code.
function AccountMenu({
  name,
  kind,
  links = [],
  action,
  secondary,
}: {
  name: string;
  // What kind of identity it is, when worth saying (a guest).
  kind: string | null;
  // The person's own pages.
  links?: { to: string; label: MenuLinkLabel }[];
  action: MenuAction | null;
  // One more action under the main one (a guest signs out as well as signing in).
  secondary?: { run: () => void; label: 'account.signOut' };
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
        {links.map((link) => (
          <Link
            key={link.to}
            className={styles.item}
            to={link.to}
            onClick={() => menu.current?.removeAttribute('open')}
          >
            <FormattedMessage id={link.label} />
          </Link>
        ))}
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
        {secondary && (
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              menu.current?.removeAttribute('open');
              secondary.run();
            }}
          >
            <FormattedMessage id={secondary.label} />
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
