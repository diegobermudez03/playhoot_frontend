import type { NotificationEntry } from '@playhoot/communication';
import { createHistory, everything, type HistoryFilter } from '@playhoot/feature-notifications';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { Button, Card, EmptyState, PageHeading, Select, Stage, Tag, TextField } from '../../ui';
import { RequireOperation } from '../access';
import { useLayout } from '../layout';
import { notificationPaths } from '../paths';
import styles from './Notifications.module.css';
import { filterableTypes, titleOf } from './notificationTypes';

// `/notifications`: the full history the bell panel abbreviates (P14§4). Opening this list marks
// nothing read — an entry is marked when its content is opened or the person marks it
// explicitly — and read is told apart from unread by a word and a mark, not by colour alone.
// Emails link here and nowhere else (P31§5), so a missing credential asks for one the usual way.
export function NotificationsRoute() {
  return (
    <RequireOperation operation={operations.readNotifications} reason="sign-in">
      <Notifications />
    </RequireOperation>
  );
}

function Notifications() {
  const intl = useIntl();
  const layout = useLayout();
  const { notificationsApi, notifications } = useServices();
  const [feature] = useState(() => createHistory({ client: notificationsApi }));
  const state = useStore(feature.store);

  useEffect(() => {
    void feature.load();
  }, [feature]);

  const markRead = (entryUUID: string) => {
    void feature.markRead(entryUUID).then(() => {
      // The bell carries the same count: it is read again so the badge agrees with this page.
      void notifications.refresh();
    });
  };

  return (
    <Stage wide={layout === 'wide'}>
      <div className={styles.page}>
        <PageHeading
          title={intl.formatMessage({ id: 'notifications.title' })}
          lead={intl.formatMessage({ id: 'notifications.page.lead' })}
          actions={
            <Link className={styles.preferencesLink} to={notificationPaths.preferences}>
              <FormattedMessage id="notifications.page.preferences" />
            </Link>
          }
        />
        <Filters filter={state.filter} onChange={(next) => void feature.setFilter(next)} />
        {state.status === 'failed' && state.error && (
          <p className={styles.danger} role="alert">
            <FormattedMessage
              id={
                state.error.kind === 'busy'
                  ? 'notifications.busy'
                  : 'notifications.page.unavailable'
              }
            />
          </p>
        )}
        {state.entries.length === 0 && state.status === 'ready' ? (
          <EmptyState
            title={intl.formatMessage({ id: 'notifications.page.emptyTitle' })}
            body={intl.formatMessage({ id: 'notifications.page.emptyBody' })}
          />
        ) : (
          <Card>
            <ul className={styles.list}>
              {state.entries.map((entry) => (
                <Entry key={entry.entryUUID} entry={entry} onMarkRead={markRead} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Stage>
  );
}

function Filters({
  filter,
  onChange,
}: {
  filter: HistoryFilter;
  onChange: (filter: HistoryFilter) => void;
}) {
  const intl = useIntl();
  return (
    <Card tone="flat">
      <section
        className={styles.filters}
        aria-label={intl.formatMessage({ id: 'notifications.filters' })}
      >
        <TextField
          label={intl.formatMessage({ id: 'notifications.filter.domain' })}
          value={filter.domain}
          onChange={(event) => onChange({ ...filter, domain: event.target.value })}
          hint={intl.formatMessage({ id: 'notifications.filter.domainHint' })}
        />
        <Select
          label={intl.formatMessage({ id: 'notifications.filter.type' })}
          value={filter.type}
          onChange={(event) => onChange({ ...filter, type: event.target.value })}
        >
          <option value="">{intl.formatMessage({ id: 'notifications.filter.any' })}</option>
          {filterableTypes.map((type) => (
            <option key={type} value={type}>
              {intl.formatMessage({ id: titleOf({ type }) })}
            </option>
          ))}
        </Select>
        <TextField
          label={intl.formatMessage({ id: 'notifications.filter.from' })}
          type="date"
          value={filter.from}
          onChange={(event) => onChange({ ...filter, from: event.target.value })}
        />
        <TextField
          label={intl.formatMessage({ id: 'notifications.filter.to' })}
          type="date"
          value={filter.to}
          onChange={(event) => onChange({ ...filter, to: event.target.value })}
        />
        <div className={styles.filterActions}>
          <Button variant="ghost" onClick={() => onChange(everything)}>
            <FormattedMessage id="notifications.filter.clear" />
          </Button>
        </div>
      </section>
    </Card>
  );
}

function Entry({
  entry,
  onMarkRead,
}: {
  entry: NotificationEntry;
  onMarkRead: (entryUUID: string) => void;
}) {
  const intl = useIntl();
  const unread = entry.readAt === null;
  return (
    <li className={styles.entry}>
      <div className={styles.entryText}>
        <p className={styles.entryTitle}>{intl.formatMessage({ id: titleOf(entry) })}</p>
        <p className={styles.entryMeta}>
          <span>
            <time dateTime={entry.createdAt}>
              {intl.formatDate(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
            </time>
          </span>
          {/* The domain is the backend's own name for the part it came from. */}
          <span>{entry.sourceDomain}</span>
          {entry.necessary && (
            <span>
              <FormattedMessage id="notifications.necessary" />
            </span>
          )}
        </p>
      </div>
      <div className={styles.entryState}>
        {/* Read and unread are told apart by a word, not by colour alone (WCAG 1.4.1). */}
        <Tag tone={unread ? 'highlight' : 'neutral'}>
          <FormattedMessage id={unread ? 'notifications.unreadMark' : 'notifications.readMark'} />
        </Tag>
        {unread && (
          <Button variant="secondary" onClick={() => onMarkRead(entry.entryUUID)}>
            <FormattedMessage id="notifications.markRead" />
          </Button>
        )}
      </div>
    </li>
  );
}
