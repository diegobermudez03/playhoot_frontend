import { createMarketsPanel } from '@playhoot/feature-admin';
import { marketFunctions } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import {
  Button,
  Card,
  Checkbox,
  PageHeading,
  Select,
  Status,
  StatusArea,
  TextField,
} from '../../ui';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { functionText } from './labels';
import { reasonMaxLength } from './StepUpForm';
import { useAdminPanel } from './useAdmin';

// What stands in for a value the backend did not set.
const noValue = '—';

type Group = 'current' | 'scheduled' | 'history';

// `/admin/markets`: the market-and-function matrix over the H1 endpoints (D-038), with the
// append form that schedules a change. No step-up: the operation is admin-level, not destructive
// (D-023's sensitive-action rule is about budget and the second factor, not this panel).
export function AdminMarketsRoute() {
  const intl = useIntl();
  const { admin } = useServices();
  const { panel, state } = useAdminPanel(() => createMarketsPanel({ admin }));
  const [group, setGroup] = useState<Group>('current');
  const matrix = state.matrix;
  const rows = matrix ? matrix[group] : [];
  const conditionsPending =
    state.actionError?.kind === 'conflict' && state.actionError.code === 'conditions_pending';

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.markets.title' })}
        lead={intl.formatMessage({ id: 'admin.markets.lead' })}
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
          <Status tone="success">
            <FormattedMessage id="admin.markets.applied" values={{ outcome: state.result }} />
          </Status>
        )}
      </StatusArea>

      <div
        className={styles.actions}
        role="tablist"
        aria-label={intl.formatMessage({ id: 'admin.markets.groupLabel' })}
      >
        {(['current', 'scheduled', 'history'] as const).map((each) => (
          <Button
            key={each}
            role="tab"
            aria-selected={group === each}
            variant={group === each ? 'primary' : 'secondary'}
            onClick={() => setGroup(each)}
          >
            <FormattedMessage
              id={`admin.markets.group.${each}`}
              values={{ count: matrix ? matrix[each].length : 0 }}
            />
          </Button>
        ))}
      </div>

      <div className={styles.tableWrap} role="tabpanel">
        <table className={styles.table}>
          <caption>
            <FormattedMessage id={`admin.markets.group.${group}`} values={{ count: rows.length }} />
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.place" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.function" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.enabled" />
              </th>
              <th scope="col" className={styles.numeric}>
                <FormattedMessage id="admin.markets.column.minAge" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.conditionsNote" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.effectiveAt" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.markets.column.reason" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rule, index) => (
              <tr
                key={`${rule.country}-${rule.subdivision}-${rule.function}-${rule.effective_at}-${index}`}
              >
                <th scope="row">
                  {rule.subdivision ? (
                    <FormattedMessage
                      id="admin.markets.placeWithSubdivision"
                      values={{ country: rule.country, subdivision: rule.subdivision }}
                    />
                  ) : (
                    rule.country
                  )}
                </th>
                <td>{functionText(intl, rule.function)}</td>
                <td>
                  <FormattedMessage id={rule.enabled ? 'admin.markets.yes' : 'admin.markets.no'} />
                </td>
                <td className={styles.numeric}>{rule.min_age || noValue}</td>
                <td>{rule.conditions_note || noValue}</td>
                <td>
                  <FormattedDate value={rule.effective_at} dateStyle="short" timeStyle="short" />
                </td>
                <td>{rule.reason || noValue}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <FormattedMessage id="admin.markets.none" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="admin.markets.appendTitle" />
          </h2>
          {conditionsPending && (
            <Status tone="warning">
              <span>
                <FormattedMessage id="admin.markets.error.conditionsPending" />
              </span>
            </Status>
          )}
          {state.actionError && !conditionsPending && (
            <Status tone="danger">
              <span>{adminErrorText(intl, state.actionError)}</span>
            </Status>
          )}
          <AppendForm busy={state.working} onSubmit={(rule) => void panel.appendRule(rule)} />
        </div>
      </Card>
    </div>
  );
}

function AppendForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (rule: {
    country: string;
    subdivision: string;
    function: string;
    enabled: boolean;
    min_age: number;
    conditions_note: string;
    effective_at?: string;
    reason: string;
  }) => void;
}) {
  const intl = useIntl();
  const [country, setCountry] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [marketFunction, setMarketFunction] = useState<string>(marketFunctions[0]);
  const [enabled, setEnabled] = useState(true);
  const [minAge, setMinAge] = useState('');
  const [conditionsNote, setConditionsNote] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [reason, setReason] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (country.trim() === '' || reason.trim() === '') return;
    onSubmit({
      country: country.trim(),
      subdivision: subdivision.trim(),
      function: marketFunction,
      enabled,
      min_age: minAge === '' ? 0 : Number(minAge),
      conditions_note: conditionsNote.trim(),
      ...(effectiveAt !== '' && { effective_at: new Date(effectiveAt).toISOString() }),
      reason: reason.trim(),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.formRow}>
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.countryLabel' })}
          hint={intl.formatMessage({ id: 'admin.markets.countryHint' })}
          value={country}
          onChange={(event) => setCountry(event.target.value.toUpperCase())}
          maxLength={2}
          required
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.subdivisionLabel' })}
          hint={intl.formatMessage({ id: 'admin.markets.subdivisionHint' })}
          value={subdivision}
          onChange={(event) => setSubdivision(event.target.value.toUpperCase())}
          maxLength={3}
        />
        <Select
          label={intl.formatMessage({ id: 'admin.markets.column.function' })}
          value={marketFunction}
          onChange={(event) => setMarketFunction(event.target.value)}
        >
          {marketFunctions.map((each) => (
            <option key={each} value={each}>
              {functionText(intl, each)}
            </option>
          ))}
        </Select>
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.column.minAge' })}
          hint={intl.formatMessage({ id: 'admin.markets.minAgeHint' })}
          type="number"
          min="0"
          max="99"
          step="1"
          inputMode="numeric"
          value={minAge}
          onChange={(event) => setMinAge(event.target.value)}
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.column.conditionsNote' })}
          hint={intl.formatMessage({ id: 'admin.markets.conditionsNoteHint' })}
          value={conditionsNote}
          onChange={(event) => setConditionsNote(event.target.value)}
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.effectiveAtLabel' })}
          hint={intl.formatMessage({ id: 'admin.markets.effectiveAtHint' })}
          type="datetime-local"
          value={effectiveAt}
          onChange={(event) => setEffectiveAt(event.target.value)}
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.markets.column.reason' })}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={reasonMaxLength}
          required
        />
      </div>
      <Checkbox
        label={intl.formatMessage({ id: 'admin.markets.enabledLabel' })}
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
      />
      <div className={styles.actions}>
        <Button
          type="submit"
          loading={busy}
          disabled={country.trim() === '' || reason.trim() === ''}
        >
          <FormattedMessage id="admin.markets.appendSubmit" />
        </Button>
      </div>
    </form>
  );
}
