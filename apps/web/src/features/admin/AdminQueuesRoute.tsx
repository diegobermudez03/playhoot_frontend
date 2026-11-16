import { createQueuesPanel } from '@playhoot/feature-admin';
import type { DeadTaskResponse } from '@playhoot/protocol';
import { useState } from 'react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import { Button, Dialog, EmptyState, PageHeading, Status, StatusArea, Tag } from '../../ui';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { useAdminPanel } from './useAdmin';

// `/admin/queues`: every domain queue's dead tasks, with retry and cancel (V-05). Retrying puts a
// task back to pending; cancelling frees its idempotency key. A task that is no longer dead is
// reported as such and changes nothing, and the list is read again after every action.
export function AdminQueuesRoute() {
  const intl = useIntl();
  const { admin } = useServices();
  const { panel, state } = useAdminPanel(() => createQueuesPanel({ admin }));
  // The task whose cancellation is being confirmed: cancelling frees the key for good.
  const [cancelling, setCancelling] = useState<DeadTaskResponse | null>(null);

  const byQueue = new Map<string, DeadTaskResponse[]>();
  for (const task of state.tasks) {
    byQueue.set(task.domain, [...(byQueue.get(task.domain) ?? []), task]);
  }

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.queues.title' })}
        lead={intl.formatMessage({ id: 'admin.queues.lead' })}
        actions={
          <Button variant="secondary" onClick={() => void panel.refresh()}>
            <FormattedMessage id="admin.refresh" />
          </Button>
        }
      />

      <StatusArea>
        {state.status === 'loading' && (
          <Status tone="info">
            <FormattedMessage id="admin.loading" />
          </Status>
        )}
        {state.error && (
          <Status tone="danger">
            <span>{adminErrorText(intl, state.error)}</span>
          </Status>
        )}
        {state.result && (
          <Status
            tone={state.result === 'not-dead' || state.result === 'gone' ? 'info' : 'success'}
          >
            <FormattedMessage id={`admin.queues.result.${state.result}`} />
          </Status>
        )}
      </StatusArea>

      {state.unavailable.length > 0 && (
        <Status tone="warning">
          <FormattedMessage
            id="admin.queues.unavailable"
            values={{ queues: state.unavailable.join(', ') }}
          />
        </Status>
      )}

      {state.status === 'ready' && state.tasks.length === 0 ? (
        <EmptyState
          title={intl.formatMessage({ id: 'admin.queues.none' })}
          body={intl.formatMessage({ id: 'admin.queues.noneBody' })}
          bare
        />
      ) : (
        [...byQueue.entries()].map(([domain, tasks]) => (
          <div className={styles.tableWrap} key={domain}>
            <table className={styles.table}>
              <caption>
                <FormattedMessage
                  id="admin.queues.queueCaption"
                  values={{ queue: domain, count: tasks.length }}
                />
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <FormattedMessage id="admin.queues.column.type" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="admin.queues.column.task" />
                  </th>
                  <th scope="col" className={styles.numeric}>
                    <FormattedMessage id="admin.queues.column.attempts" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="admin.queues.column.lastError" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="admin.queues.column.diedAt" />
                  </th>
                  <th scope="col">
                    <FormattedMessage id="admin.queues.column.actions" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.task_uuid}>
                    <th scope="row">{task.type}</th>
                    <td className={styles.mono}>{task.task_uuid}</td>
                    <td className={styles.numeric}>
                      {task.attempts}
                      {task.admin_retries > 0 && (
                        <Tag tone="info">
                          <FormattedMessage
                            id="admin.queues.adminRetries"
                            values={{ count: task.admin_retries }}
                          />
                        </Tag>
                      )}
                    </td>
                    <td>{task.last_error}</td>
                    <td>
                      <FormattedDate value={task.died_at} dateStyle="short" timeStyle="medium" />
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button
                          size="sm"
                          loading={state.working === task.task_uuid}
                          disabled={state.working !== null}
                          onClick={() => void panel.retry(task.task_uuid)}
                        >
                          <FormattedMessage
                            id="admin.queues.retryNamed"
                            values={{ type: task.type }}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={state.working !== null}
                          onClick={() => setCancelling(task)}
                        >
                          <FormattedMessage
                            id="admin.queues.cancelNamed"
                            values={{ type: task.type }}
                          />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <Dialog
        open={cancelling !== null}
        title={intl.formatMessage({ id: 'admin.queues.cancelTitle' })}
        closeLabel={intl.formatMessage({ id: 'admin.close' })}
        onClose={() => setCancelling(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              <FormattedMessage id="admin.cancel" />
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const task = cancelling;
                setCancelling(null);
                if (task) void panel.cancel(task.task_uuid);
              }}
            >
              <FormattedMessage id="admin.queues.cancelConfirm" />
            </Button>
          </>
        }
      >
        <p className={styles.note}>
          <FormattedMessage
            id="admin.queues.cancelBody"
            values={{ type: cancelling?.type ?? '', queue: cancelling?.domain ?? '' }}
          />
        </p>
      </Dialog>
    </div>
  );
}
