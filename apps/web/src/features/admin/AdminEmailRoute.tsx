import { createEmailPanel } from '@playhoot/feature-admin';
import { emailModes, resendDailyQuota, resendMonthlyQuota } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedDate, FormattedMessage, FormattedNumber, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import { Button, Card, PageHeading, Select, Status, StatusArea, Tag, TextField } from '../../ui';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { money } from './AdminHomeRoute';
import { deliveryStateText, deliveryTone, emailModeText } from './labels';
import { reasonMaxLength } from './StepUpForm';
import { useAdminPanel } from './useAdmin';

// `/admin/email`: the outbound email mode, what each provider has spent, and deliveries by state
// (P31§2). No body of any email is here, because none is kept (P31§5).
export function AdminEmailRoute() {
  const intl = useIntl();
  const { admin } = useServices();
  const { panel, state } = useAdminPanel(() => createEmailPanel({ admin }));
  const email = state.email;
  const usage = email?.usage ?? [];

  const deliveries: [string, number][] = Object.entries(email?.deliveries_30d ?? {});

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.email.title' })}
        lead={intl.formatMessage({ id: 'admin.email.lead' })}
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
        {state.actionError && (
          <Status tone="danger">
            <span>{adminErrorText(intl, state.actionError)}</span>
          </Status>
        )}
        {state.result && (
          <Status tone="success">
            <FormattedMessage id="admin.email.modeSet" values={{ outcome: state.result }} />
          </Status>
        )}
      </StatusArea>

      {email && (
        <>
          <ModeForm
            current={email.mode}
            since={email.mode_since}
            reasonInForce={email.mode_reason}
            busy={state.working !== null}
            onSubmit={(mode, reason) => void panel.setMode(mode, reason)}
          />

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{intl.formatMessage({ id: 'admin.email.usageTitle' })}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <FormattedMessage id="admin.email.column.provider" />
                  </th>
                  <th scope="col" className={styles.numeric}>
                    <FormattedMessage id="admin.email.column.today" />
                  </th>
                  <th scope="col" className={styles.numeric}>
                    <FormattedMessage id="admin.email.column.month" />
                  </th>
                  <th scope="col" className={styles.numeric}>
                    <FormattedMessage id="admin.email.column.cost" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.map((provider) => (
                  <tr key={provider.provider}>
                    <th scope="row">{provider.provider}</th>
                    <td className={styles.numeric}>
                      {provider.provider === resendProvider ? (
                        <FormattedMessage
                          id="admin.email.ofQuota"
                          values={{ used: provider.today, quota: resendDailyQuota }}
                        />
                      ) : (
                        <FormattedNumber value={provider.today} />
                      )}
                    </td>
                    <td className={styles.numeric}>
                      {provider.provider === resendProvider ? (
                        <FormattedMessage
                          id="admin.email.ofQuota"
                          values={{ used: provider.month, quota: resendMonthlyQuota }}
                        />
                      ) : (
                        <FormattedNumber value={provider.month} />
                      )}
                    </td>
                    <td className={styles.numeric}>
                      <FormattedNumber value={provider.estimated_usd} {...money} />
                    </td>
                  </tr>
                ))}
                {usage.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <FormattedMessage id="admin.email.noUsage" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Card>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FormattedMessage id="admin.email.deliveriesTitle" />
              </h2>
              <p className={styles.note}>
                <FormattedMessage id="admin.email.deliveriesNote" />
              </p>
              <div className={styles.tags}>
                {deliveries.map(([deliveryState, count]) => (
                  <Tag key={deliveryState} tone={deliveryTone(deliveryState)}>
                    <FormattedMessage
                      id="admin.email.deliveryCount"
                      values={{ state: deliveryStateText(intl, deliveryState), count }}
                    />
                  </Tag>
                ))}
                {deliveries.length === 0 && (
                  <span className={styles.note}>
                    <FormattedMessage id="admin.email.noDeliveries" />
                  </span>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const resendProvider = 'resend';

// The mode is switched without deploying (P31§2), with the reason the change is recorded under.
function ModeForm({
  current,
  since,
  reasonInForce,
  busy,
  onSubmit,
}: {
  current: string;
  since: string;
  reasonInForce: string;
  busy: boolean;
  onSubmit: (mode: string, reason: string) => void;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState(current);
  const [reason, setReason] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim() === '') return;
    onSubmit(mode, reason.trim());
    setReason('');
  };
  // A mode the backend reports that this build does not know is still offered back unchanged.
  const choices = emailModes.includes(current as (typeof emailModes)[number])
    ? emailModes
    : [current, ...emailModes];
  return (
    <Card>
      <form className={styles.form} onSubmit={submit} noValidate>
        <h2 className={styles.sectionTitle}>
          <FormattedMessage id="admin.email.modeTitle" />
        </h2>
        <p className={styles.note}>
          <FormattedMessage
            id="admin.email.modeInForce"
            values={{ mode: emailModeText(intl, current), reason: reasonInForce || '—' }}
          />
          {since && (
            <>
              {' '}
              <FormattedDate value={since} dateStyle="short" timeStyle="short" />
            </>
          )}
        </p>
        <div className={styles.formRow}>
          <Select
            label={intl.formatMessage({ id: 'admin.email.modeLabel' })}
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {choices.map((each) => (
              <option key={each} value={each}>
                {emailModeText(intl, each)}
              </option>
            ))}
          </Select>
          <TextField
            label={intl.formatMessage({ id: 'admin.stepUp.reasonLabel' })}
            hint={intl.formatMessage({ id: 'admin.email.reasonHint' })}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={reasonMaxLength}
            required
          />
        </div>
        <div className={styles.actions}>
          <Button type="submit" loading={busy} disabled={reason.trim() === ''}>
            <FormattedMessage id="admin.email.setMode" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
