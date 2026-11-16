import type { NotificationEntry } from '@playhoot/communication';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router';
import { useStore } from 'zustand';

import type { MessageId } from '../../i18n/catalogs';
import { useAuth, useOptionalServices, useServices } from '../ServicesContext';
import styles from './NotificationsBell.module.css';

// The bar's notifications: the unread count, and a panel with the plain entry list. Opening the
// panel marks nothing read; an entry is marked when the person says so (P14§4). The list each
// kind of entry leads to, and the screens it leads to, belong to their own milestones.
// The server renders the bar before the app exists, and who the person is is known only in the
// browser: there is no bell until then.
export function NotificationsBell() {
  return useOptionalServices() ? <BellForSignedIn /> : null;
}

function BellForSignedIn() {
  const auth = useAuth();
  // Nobody is signed in: there are no notifications, and no bell.
  if (auth.status !== 'guest' && auth.status !== 'authenticated') return null;
  return <Bell />;
}

function Bell() {
  const intl = useIntl();
  const { notifications } = useServices();
  const state = useStore(notifications.store);
  const location = useLocation();

  // The count is read again on every navigation, so the badge is never older than the page.
  useEffect(() => {
    void notifications.refresh();
  }, [notifications, location.key]);

  const unread = state.unread;
  // The count in the reader's own number format, with a ceiling so the badge keeps its shape.
  const badge =
    unread > badgeCeiling
      ? intl.formatMessage({ id: 'notifications.badgeMax' }, { max: badgeCeiling })
      : intl.formatNumber(unread);
  return (
    <details className={styles.bell}>
      <summary
        className={styles.summary}
        aria-label={intl.formatMessage({ id: 'notifications.open' }, { unread })}
      >
        <BellIcon />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {badge}
          </span>
        )}
      </summary>
      <div className={styles.panel}>
        <h2 className={styles.title}>{intl.formatMessage({ id: 'notifications.title' })}</h2>
        {state.status === 'failed' && (
          <p className={styles.note} role="status">
            {intl.formatMessage({ id: failureMessage(state.error?.kind) })}
          </p>
        )}
        {state.entries.length === 0 && state.status !== 'loading' && (
          <p className={styles.note}>{intl.formatMessage({ id: 'notifications.empty' })}</p>
        )}
        <ul className={styles.list}>
          {state.entries.map((entry) => (
            <li key={entry.entryUUID} className={styles.entry}>
              <p className={styles.entryText}>
                {entry.readAt === null && (
                  <span className={styles.dot}>
                    <span className={styles.visuallyHidden}>
                      {intl.formatMessage({ id: 'notifications.unreadMark' })}
                    </span>
                  </span>
                )}
                {intl.formatMessage({ id: titleOf(entry) })}
              </p>
              <p className={styles.when}>
                <time dateTime={entry.createdAt}>{day(intl, entry.createdAt)}</time>
              </p>
              {entry.readAt === null && (
                <button
                  type="button"
                  className={styles.markRead}
                  onClick={() => void notifications.markRead(entry.entryUUID)}
                >
                  {intl.formatMessage({ id: 'notifications.markRead' })}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

// What each kind of event says, in the person's language. The backend's list of types is open: a
// type this build does not know is still shown, as a notification without a sentence of its own.
const titles: Record<string, MessageId> = {
  welcome: 'notifications.type.welcome',
  'purchase-confirmed': 'notifications.type.purchaseConfirmed',
  'plan-changed': 'notifications.type.planChanged',
  'payment-failed': 'notifications.type.paymentFailed',
  'trial-update': 'notifications.type.trialUpdate',
  'account-security': 'notifications.type.accountSecurity',
  'guardian-authorization': 'notifications.type.guardianAuthorization',
  'ai-work-finished': 'notifications.type.aiWorkFinished',
  'capacity-warning': 'notifications.type.capacityWarning',
  'discovery-review': 'notifications.type.discoveryReview',
  'discovery-restriction': 'notifications.type.discoveryRestriction',
  'class-activity': 'notifications.type.classActivity',
  'budget-level-changed': 'notifications.type.budgetLevelChanged',
  marketing: 'notifications.type.marketing',
};

function titleOf(entry: NotificationEntry): MessageId {
  return titles[entry.type] ?? 'notifications.type.unknown';
}

function failureMessage(kind: 'unauthenticated' | 'busy' | 'unavailable' | undefined): MessageId {
  return kind === 'busy' ? 'notifications.busy' : 'notifications.unavailable';
}

// The day the entry was created, in the reader's language and their own time zone (P14§3).
function day(intl: ReturnType<typeof useIntl>, iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : intl.formatDate(at, { dateStyle: 'medium', timeStyle: 'short' });
}

const badgeCeiling = 99;

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={styles.icon}>
      <path d="M12 3a6 6 0 0 0-6 6c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9a6 6 0 0 0-6-6z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}
