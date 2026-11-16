import { createBudgetPanel, createEmailPanel, createQueuesPanel } from '@playhoot/feature-admin';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { Link } from 'react-router';

import { useServices } from '../../app/ServicesContext';
import { PageHeading, Skeleton, Status, Tag } from '../../ui';
import { adminPaths } from '../paths';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { emailModeText, ladderLevelText, ladderTone } from './labels';
import { useAdminPanel } from './useAdmin';

// `/admin`: the landing of the admin area. One figure per panel of this milestone, each one a way
// into its panel; later milestones add theirs beside them.
export function AdminHomeRoute() {
  const intl = useIntl();
  const { admin, secondFactor } = useServices();
  const budget = useAdminPanel(() => createBudgetPanel({ admin, secondFactor }));
  const queues = useAdminPanel(() => createQueuesPanel({ admin }));
  const email = useAdminPanel(() => createEmailPanel({ admin }));

  const deadByQueue = new Map<string, number>();
  for (const task of queues.state.tasks) {
    deadByQueue.set(task.domain, (deadByQueue.get(task.domain) ?? 0) + 1);
  }

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.home.title' })}
        lead={intl.formatMessage({ id: 'admin.home.lead' })}
      />
      <div className={styles.figures}>
        <Link className={styles.figure} to={adminPaths.budget}>
          <span className={styles.figureName}>
            <FormattedMessage id="admin.home.ladder" />
          </span>
          {budget.state.status === 'loading' ? (
            <Skeleton width="8ch" />
          ) : budget.state.budget ? (
            <>
              <span className={styles.figureValue}>
                {ladderLevelText(intl, budget.state.budget.ladder.level)}
              </span>
              <Status tone={ladderTone(budget.state.budget.ladder.level)}>
                <FormattedMessage
                  id="admin.home.lastHour"
                  values={{
                    amount: intl.formatNumber(budget.state.budget.last_hour_usd, money),
                  }}
                />
              </Status>
            </>
          ) : (
            <Unavailable
              text={budget.state.error ? adminErrorText(intl, budget.state.error) : ''}
            />
          )}
        </Link>

        <Link className={styles.figure} to={adminPaths.queues}>
          <span className={styles.figureName}>
            <FormattedMessage id="admin.home.deadTasks" />
          </span>
          {queues.state.status === 'loading' ? (
            <Skeleton width="8ch" />
          ) : queues.state.status === 'ready' ? (
            <>
              <span className={styles.figureValue}>
                <FormattedNumber value={queues.state.tasks.length} />
              </span>
              <span className={styles.tags}>
                {[...deadByQueue.entries()].map(([domain, count]) => (
                  <Tag key={domain} tone="danger">
                    <FormattedMessage id="admin.home.perQueue" values={{ queue: domain, count }} />
                  </Tag>
                ))}
                {deadByQueue.size === 0 && (
                  <Tag tone="success">
                    <FormattedMessage id="admin.queues.none" />
                  </Tag>
                )}
              </span>
            </>
          ) : (
            <Unavailable
              text={queues.state.error ? adminErrorText(intl, queues.state.error) : ''}
            />
          )}
        </Link>

        <Link className={styles.figure} to={adminPaths.email}>
          <span className={styles.figureName}>
            <FormattedMessage id="admin.home.email" />
          </span>
          {email.state.status === 'loading' ? (
            <Skeleton width="8ch" />
          ) : email.state.email ? (
            <>
              <span className={styles.figureValue}>
                {emailModeText(intl, email.state.email.mode)}
              </span>
              <span className={styles.note}>
                <FormattedMessage
                  id="admin.home.emailToday"
                  values={{
                    count: (email.state.email.usage ?? []).reduce(
                      (sum, provider) => sum + provider.today,
                      0,
                    ),
                  }}
                />
              </span>
            </>
          ) : (
            <Unavailable text={email.state.error ? adminErrorText(intl, email.state.error) : ''} />
          )}
        </Link>
      </div>
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <Status tone="danger">
      <span>{text}</span>
    </Status>
  );
}

export const money = { style: 'currency', currency: 'USD', maximumFractionDigits: 4 } as const;
