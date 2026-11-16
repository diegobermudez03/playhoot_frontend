import { budgetCategories, createBudgetPanel, globalScope } from '@playhoot/feature-admin';
import { budgetWindows, type BudgetStatusResponse } from '@playhoot/protocol';
import { useState, type ReactNode } from 'react';
import { FormattedDate, FormattedMessage, FormattedNumber, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import type { MessageId } from '../../i18n/catalogs';
import {
  Button,
  Card,
  Dialog,
  PageHeading,
  Select,
  Status,
  StatusArea,
  Tag,
  TextField,
} from '../../ui';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { money } from './AdminHomeRoute';
import { ladderLevelText, ladderTone, windowText } from './labels';
import { StepUpForm } from './StepUpForm';
import { useAdminPanel } from './useAdmin';

// What stands in for a value the backend did not set.
const noValue = '—';

// Which confirm step is open. Only one at a time: each spends its own fresh code (D-011).
type OpenAction = 'cap' | 'rate' | 'cutoff' | 'reopen' | null;

// `/admin/budget`: the restriction ladder and every cap's consumption per window, and the three
// actions that change them, each behind a fresh code (P32§4,§7; D-012, D-017).
export function AdminBudgetRoute() {
  const intl = useIntl();
  const { admin, secondFactor } = useServices();
  const { panel, state } = useAdminPanel(() => createBudgetPanel({ admin, secondFactor }));
  const [open, setOpen] = useState<OpenAction>(null);
  const budget = state.budget;
  const categories = budgetCategories(budget);
  const close = () => setOpen(null);
  const after = (applied: boolean) => {
    if (applied) close();
  };

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.budget.title' })}
        lead={intl.formatMessage({ id: 'admin.budget.lead' })}
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
            {/* The outcome is the backend's own machine word for what it did (`shut_down`,
                `already_shut_down`, `reopened`), not prose it wrote for a reader. */}
            <FormattedMessage
              id="admin.budget.applied"
              values={{ outcome: state.result.outcome }}
            />
          </Status>
        )}
      </StatusArea>

      {budget && (
        <>
          <Ladder budget={budget} />
          <Usage budget={budget} />
          <Controls budget={budget} />

          <Card>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <FormattedMessage id="admin.budget.actionsTitle" />
              </h2>
              <p className={styles.note}>
                <FormattedMessage id="admin.budget.actionsNote" />
              </p>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setOpen('cap')}>
                  <FormattedMessage id="admin.budget.setCap" />
                </Button>
                <Button variant="secondary" onClick={() => setOpen('rate')}>
                  <FormattedMessage id="admin.budget.setRate" />
                </Button>
                <Button variant="secondary" onClick={() => setOpen('reopen')}>
                  <FormattedMessage id="admin.budget.reopen" />
                </Button>
                <Button variant="danger" onClick={() => setOpen('cutoff')}>
                  <FormattedMessage id="admin.budget.cutoff" />
                </Button>
              </div>

              {open === 'cap' && (
                <CapForm
                  categories={categories}
                  busy={state.working === 'controls'}
                  error={state.actionError}
                  onCancel={close}
                  onSubmit={(code, reason, cap) =>
                    void panel.setControls(code, { caps: [cap], reason }).then(after)
                  }
                />
              )}
              {open === 'rate' && (
                <RateForm
                  categories={categories}
                  busy={state.working === 'controls'}
                  error={state.actionError}
                  onCancel={close}
                  onSubmit={(code, reason, rate) =>
                    void panel.setControls(code, { rates: [rate], reason }).then(after)
                  }
                />
              )}
              {open === 'reopen' && (
                <ReopenForm
                  budget={budget}
                  busy={state.working === 'reopen'}
                  error={state.actionError}
                  onCancel={close}
                  onSubmit={(code, reason, chosen) =>
                    void panel.reopen(code, chosen, reason).then(after)
                  }
                />
              )}
            </div>
          </Card>
        </>
      )}

      {/* The cutoff stops the platform at once: it is confirmed in a real dialog, which traps
          focus and names what the button does (WCAG 2.2 2.1.2, 3.3.2). */}
      <Dialog
        open={open === 'cutoff'}
        title={intl.formatMessage({ id: 'admin.budget.cutoffTitle' })}
        closeLabel={intl.formatMessage({ id: 'admin.close' })}
        onClose={close}
      >
        <p className={styles.note}>
          <FormattedMessage id="admin.budget.cutoffBody" />
        </p>
        {/* Built only while the dialog is open, so a code and a reason typed and then abandoned
            are not left sitting in a closed form. */}
        {open === 'cutoff' && (
          <StepUpForm
            submitLabel={intl.formatMessage({ id: 'admin.budget.cutoffConfirm' })}
            busy={state.working === 'cutoff'}
            error={state.actionError}
            onCancel={close}
            onSubmit={(code, reason) => void panel.cutoff(code, reason).then(after)}
          />
        )}
      </Dialog>
    </div>
  );
}

function Ladder({ budget }: { budget: BudgetStatusResponse }) {
  const intl = useIntl();
  const { ladder } = budget;
  return (
    <Card>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="admin.budget.ladderTitle" />
          </h2>
          <Status tone={ladderTone(ladder.level)}>
            <span>{ladderLevelText(intl, ladder.level)}</span>
          </Status>
        </div>
        <p className={styles.note}>
          <FormattedMessage
            id="admin.budget.ladderReason"
            values={{ reason: ladder.reason || noValue, actor: ladder.actor || noValue }}
          />
          {ladder.since && (
            <>
              {' '}
              <FormattedDate value={ladder.since} dateStyle="short" timeStyle="short" />
            </>
          )}
        </p>
        {ladder.paused_categories.length > 0 && (
          <p className={styles.tags}>
            <span className={styles.note}>
              <FormattedMessage id="admin.budget.paused" />
            </span>
            {ladder.paused_categories.map((category) => (
              <Tag key={category} tone="danger">
                {category}
              </Tag>
            ))}
          </p>
        )}
        {ladder.reopen_closed.length > 0 && (
          <p className={styles.tags}>
            <span className={styles.note}>
              <FormattedMessage id="admin.budget.heldClosed" />
            </span>
            {ladder.reopen_closed.map((category) => (
              <Tag key={category} tone="accent">
                {category}
              </Tag>
            ))}
          </p>
        )}
        {budget.rate_missing.length > 0 && (
          <Status tone="warning">
            <FormattedMessage
              id="admin.budget.rateMissing"
              values={{ categories: budget.rate_missing.join(', ') }}
            />
          </Status>
        )}
        <div className={styles.figures}>
          <Figure nameId="admin.budget.lastHour">
            <FormattedNumber value={budget.last_hour_usd} {...money} />
          </Figure>
          <Figure nameId="admin.budget.reservations">
            <FormattedNumber value={budget.active_reservations} />
          </Figure>
          <Figure nameId="admin.budget.hoursToCap">
            {budget.hours_to_month_cap === null ? (
              <FormattedMessage id="admin.budget.noProjection" />
            ) : (
              <FormattedMessage
                id="admin.budget.hours"
                values={{ hours: Math.round(budget.hours_to_month_cap) }}
              />
            )}
          </Figure>
        </div>
      </div>
    </Card>
  );
}

function Figure({ nameId, children }: { nameId: MessageId; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureName}>
        <FormattedMessage id={nameId} />
      </span>
      <span className={styles.figureValue}>{children}</span>
    </div>
  );
}

// Measured, estimated and reserved spend against the cap of every scope and window. A scope with
// no cap is named as such: that blocks its admission, it is not unlimited (P32§2).
function Usage({ budget }: { budget: BudgetStatusResponse }) {
  const intl = useIntl();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{intl.formatMessage({ id: 'admin.budget.usageTitle' })}</caption>
        <thead>
          <tr>
            <th scope="col">
              <FormattedMessage id="admin.budget.column.scope" />
            </th>
            <th scope="col">
              <FormattedMessage id="admin.budget.column.window" />
            </th>
            <th scope="col" className={styles.numeric}>
              <FormattedMessage id="admin.budget.column.measured" />
            </th>
            <th scope="col" className={styles.numeric}>
              <FormattedMessage id="admin.budget.column.estimated" />
            </th>
            <th scope="col" className={styles.numeric}>
              <FormattedMessage id="admin.budget.column.reserved" />
            </th>
            <th scope="col" className={styles.numeric}>
              <FormattedMessage id="admin.budget.column.limit" />
            </th>
          </tr>
        </thead>
        <tbody>
          {budget.usage.map((row) => (
            <tr key={`${row.scope}-${row.window}`}>
              <th scope="row">
                {row.scope === globalScope
                  ? intl.formatMessage({ id: 'admin.budget.global' })
                  : row.scope}
              </th>
              <td>{windowText(intl, row.window)}</td>
              <td className={styles.numeric}>
                <FormattedNumber value={row.measured_usd} {...money} />
              </td>
              <td className={styles.numeric}>
                <FormattedNumber value={row.estimated_usd} {...money} />
              </td>
              <td className={styles.numeric}>
                <FormattedNumber value={row.reserved_usd} {...money} />
              </td>
              <td className={styles.numeric}>
                {row.limit_usd === null ? (
                  <FormattedMessage id="admin.budget.noCap" />
                ) : (
                  <FormattedNumber value={row.limit_usd} {...money} />
                )}
              </td>
            </tr>
          ))}
          {budget.usage.length === 0 && (
            <tr>
              <td colSpan={6}>
                <FormattedMessage id="admin.budget.noUsage" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// The caps and prices in force, as the backend's latest rows.
function Controls({ budget }: { budget: BudgetStatusResponse }) {
  const intl = useIntl();
  return (
    <div className={styles.formRow}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{intl.formatMessage({ id: 'admin.budget.capsTitle' })}</caption>
          <thead>
            <tr>
              <th scope="col">
                <FormattedMessage id="admin.budget.column.scope" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.budget.column.window" />
              </th>
              <th scope="col" className={styles.numeric}>
                <FormattedMessage id="admin.budget.column.limit" />
              </th>
              <th scope="col" className={styles.numeric}>
                <FormattedMessage id="admin.budget.column.concurrency" />
              </th>
              <th scope="col" className={styles.numeric}>
                <FormattedMessage id="admin.budget.column.volume" />
              </th>
            </tr>
          </thead>
          <tbody>
            {budget.caps.map((cap) => (
              <tr key={`${cap.scope}-${cap.window}`}>
                <th scope="row">
                  {cap.scope === globalScope
                    ? intl.formatMessage({ id: 'admin.budget.global' })
                    : cap.scope}
                </th>
                <td>{windowText(intl, cap.window)}</td>
                <td className={styles.numeric}>
                  <FormattedNumber value={cap.usd_limit} {...money} />
                </td>
                <td className={styles.numeric}>{cap.max_concurrency ?? noValue}</td>
                <td className={styles.numeric}>{cap.max_volume ?? noValue}</td>
              </tr>
            ))}
            {budget.caps.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <FormattedMessage id="admin.budget.noCaps" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{intl.formatMessage({ id: 'admin.budget.ratesTitle' })}</caption>
          <thead>
            <tr>
              <th scope="col">
                <FormattedMessage id="admin.budget.column.category" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.budget.column.service" />
              </th>
              <th scope="col">
                <FormattedMessage id="admin.budget.column.unit" />
              </th>
              <th scope="col" className={styles.numeric}>
                <FormattedMessage id="admin.budget.column.price" />
              </th>
            </tr>
          </thead>
          <tbody>
            {budget.rates.map((rate) => (
              <tr key={`${rate.category}-${rate.service}-${rate.unit}`}>
                <th scope="row">{rate.category}</th>
                <td>{rate.service}</td>
                <td>{rate.unit}</td>
                <td className={styles.numeric}>
                  <FormattedNumber value={rate.usd_per_unit} {...money} />
                </td>
              </tr>
            ))}
            {budget.rates.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <FormattedMessage id="admin.budget.noRates" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapForm({
  categories,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  categories: string[];
  busy: boolean;
  error: Parameters<typeof StepUpForm>[0]['error'];
  onCancel: () => void;
  onSubmit: (
    code: string,
    reason: string,
    cap: {
      scope: string;
      window: string;
      usd_limit: number;
      max_concurrency?: number;
      max_volume?: number;
    },
  ) => void;
}) {
  const intl = useIntl();
  const [scope, setScope] = useState(globalScope);
  const [window, setWindow] = useState<string>(budgetWindows[0]);
  const [limit, setLimit] = useState('');
  const [concurrency, setConcurrency] = useState('');
  const [volume, setVolume] = useState('');
  return (
    <StepUpForm
      submitLabel={intl.formatMessage({ id: 'admin.budget.setCapConfirm' })}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(code, reason) =>
        onSubmit(code, reason, {
          scope,
          window,
          usd_limit: Number(limit),
          ...(concurrency !== '' && { max_concurrency: Number(concurrency) }),
          ...(volume !== '' && { max_volume: Number(volume) }),
        })
      }
    >
      <div className={styles.formRow}>
        <ScopeField categories={categories} value={scope} onChange={setScope} />
        <Select
          label={intl.formatMessage({ id: 'admin.budget.column.window' })}
          value={window}
          onChange={(event) => setWindow(event.target.value)}
        >
          {budgetWindows.map((each) => (
            <option key={each} value={each}>
              {windowText(intl, each)}
            </option>
          ))}
        </Select>
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.limitLabel' })}
          type="number"
          min="0"
          step="0.0001"
          inputMode="decimal"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          required
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.concurrencyLabel' })}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={concurrency}
          onChange={(event) => setConcurrency(event.target.value)}
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.volumeLabel' })}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={volume}
          onChange={(event) => setVolume(event.target.value)}
        />
      </div>
    </StepUpForm>
  );
}

function RateForm({
  categories,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  categories: string[];
  busy: boolean;
  error: Parameters<typeof StepUpForm>[0]['error'];
  onCancel: () => void;
  onSubmit: (
    code: string,
    reason: string,
    rate: { category: string; service: string; unit: string; usd_per_unit: number },
  ) => void;
}) {
  const intl = useIntl();
  const [category, setCategory] = useState(categories[0] ?? '');
  const [service, setService] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  return (
    <StepUpForm
      submitLabel={intl.formatMessage({ id: 'admin.budget.setRateConfirm' })}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(code, reason) =>
        onSubmit(code, reason, { category, service, unit, usd_per_unit: Number(price) })
      }
    >
      <div className={styles.formRow}>
        <ScopeField
          categories={categories}
          value={category}
          onChange={setCategory}
          withGlobal={false}
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.column.service' })}
          value={service}
          onChange={(event) => setService(event.target.value)}
          required
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.column.unit' })}
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          required
        />
        <TextField
          label={intl.formatMessage({ id: 'admin.budget.priceLabel' })}
          type="number"
          min="0"
          step="0.000001"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
        />
      </div>
    </StepUpForm>
  );
}

// Categories come from the backend's own answer, and a new one can always be typed: this client
// never decides which categories exist.
function ScopeField({
  categories,
  value,
  onChange,
  withGlobal = true,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  withGlobal?: boolean;
}) {
  const intl = useIntl();
  const listId = 'admin-budget-categories';
  return (
    <>
      <TextField
        label={intl.formatMessage({ id: 'admin.budget.column.scope' })}
        hint={intl.formatMessage({
          id: withGlobal ? 'admin.budget.scopeHint' : 'admin.budget.categoryHint',
        })}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <datalist id={listId}>
        {(withGlobal ? [globalScope, ...categories] : categories).map((each) => (
          <option key={each} value={each} />
        ))}
      </datalist>
    </>
  );
}

// Leaving a shutdown is gradual (P32§7): the first step names no category and leaves everything
// closed at `restricted`; each later step opens the ones it names.
function ReopenForm({
  budget,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  budget: BudgetStatusResponse;
  busy: boolean;
  error: Parameters<typeof StepUpForm>[0]['error'];
  onCancel: () => void;
  onSubmit: (code: string, reason: string, categories: string[]) => void;
}) {
  const intl = useIntl();
  const closed = budget.ladder.reopen_closed;
  const firstStep = budget.ladder.level === 'shutdown';
  const [chosen, setChosen] = useState<string[]>([]);
  const toggle = (category: string) =>
    setChosen((current) =>
      current.includes(category)
        ? current.filter((each) => each !== category)
        : [...current, category],
    );
  return (
    <StepUpForm
      submitLabel={intl.formatMessage({ id: 'admin.budget.reopenConfirm' })}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(code, reason) => onSubmit(code, reason, firstStep ? [] : chosen)}
    >
      <p className={styles.note}>
        <FormattedMessage
          id={firstStep ? 'admin.budget.reopenFirstStep' : 'admin.budget.reopenLaterStep'}
        />
      </p>
      {!firstStep && (
        <div className={styles.choices}>
          {closed.map((category) => (
            <label className={styles.choice} key={category}>
              <input
                type="checkbox"
                checked={chosen.includes(category)}
                onChange={() => toggle(category)}
              />
              <span>{category}</span>
            </label>
          ))}
          {closed.length === 0 && (
            <p className={styles.note}>
              <FormattedMessage id="admin.budget.nothingClosed" />
            </p>
          )}
        </div>
      )}
    </StepUpForm>
  );
}
