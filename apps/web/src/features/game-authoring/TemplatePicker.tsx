import type { TemplateEntry } from '@playhoot/communication';
import { createTemplateBrowser, type TemplateBrowser } from '@playhoot/feature-game-authoring';
import { useEffect, useState, type FormEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { Button, TextField } from '../../ui';
import styles from './GameWorkspace.module.css';

// Finding a template: the featured ones first, a search, and one inspected before choosing it.
// With an empty catalog it says so: the game then starts from the starter project. A template's
// name, description and brief are its owner's and their AI's texts, shown as written.
export function TemplatePicker({
  chosen,
  onChoose,
  chooseLabel,
  busy,
}: {
  chosen: string | null;
  onChoose: (template: TemplateEntry) => void;
  chooseLabel: 'templates.choose' | 'templates.use';
  busy?: boolean;
}) {
  const services = useServices();
  const [browser, setBrowser] = useState<TemplateBrowser | null>(null);
  useEffect(() => {
    const next = createTemplateBrowser({ games: services.gamesApi });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setBrowser(next);
    void next.load();
    return () => next.dispose();
  }, [services]);
  if (!browser) return null;
  return (
    <Picker
      browser={browser}
      chosen={chosen}
      onChoose={onChoose}
      chooseLabel={chooseLabel}
      busy={busy ?? false}
    />
  );
}

function Picker({
  browser,
  chosen,
  onChoose,
  chooseLabel,
  busy,
}: {
  browser: TemplateBrowser;
  chosen: string | null;
  onChoose: (template: TemplateEntry) => void;
  chooseLabel: 'templates.choose' | 'templates.use';
  busy: boolean;
}) {
  const intl = useIntl();
  const state = useStore(browser.store, (current) => current);
  const [text, setText] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void browser.search({ text: text.trim(), page: 1 });
  };

  if (state.status === 'loading') {
    return (
      <p className={styles.muted}>
        <FormattedMessage id="templates.loading" />
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <p className={styles.warningText}>
        <FormattedMessage id="templates.failed" />
      </p>
    );
  }
  if (state.featured.length === 0 && state.categories.length === 0 && state.search === null) {
    return (
      <p className={styles.muted} data-testid="templates-empty">
        <FormattedMessage id="templates.empty" />
      </p>
    );
  }
  const listed = state.search?.page?.templates ?? state.featured;
  return (
    <div className={styles.sectionStack} data-testid="template-picker">
      <form className={styles.listRow} onSubmit={submit}>
        <TextField
          label={intl.formatMessage({ id: 'templates.searchLabel' })}
          placeholder={intl.formatMessage({ id: 'templates.searchPlaceholder' })}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          <FormattedMessage id="templates.search" />
        </Button>
      </form>
      {state.search?.status === 'done' && listed.length === 0 && (
        <p className={styles.muted}>
          <FormattedMessage id="templates.noResults" />
        </p>
      )}
      <ul className={styles.list}>
        {listed.map((template) => (
          <li key={template.gameUUID} className={styles.listItem}>
            <div className={styles.listRow}>
              <strong>{template.name}</strong>
              <span className={styles.muted}>
                <FormattedMessage
                  id="templates.players"
                  values={{ min: template.playersMin, max: template.playersMax }}
                />
              </span>
              {template.gameUUID === chosen && (
                <span className={`${styles.badge} ${styles.badgeOk}`}>
                  <FormattedMessage id="templates.chosen" />
                </span>
              )}
            </div>
            {template.description && <p className={styles.muted}>{template.description}</p>}
            <div className={styles.listRow}>
              <Button
                size="md"
                variant="ghost"
                onClick={() => void browser.inspect(template.gameUUID)}
              >
                <FormattedMessage id="templates.inspect" />
              </Button>
              <Button
                size="md"
                variant="secondary"
                disabled={busy}
                onClick={() => onChoose(template)}
                data-testid={`choose-template-${template.gameUUID}`}
              >
                <FormattedMessage id={chooseLabel} />
              </Button>
            </div>
            {state.inspected?.gameUUID === template.gameUUID && (
              <Inspected inspected={state.inspected} onClose={browser.closeInspection} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Inspected({
  inspected,
  onClose,
}: {
  inspected: NonNullable<ReturnType<TemplateBrowser['store']['getState']>['inspected']>;
  onClose: () => void;
}) {
  const details = inspected.details;
  const goal =
    details &&
    typeof details.brief === 'object' &&
    details.brief !== null &&
    'goal' in details.brief
      ? String((details.brief as { goal: unknown }).goal)
      : null;
  return (
    <div className={styles.summary} data-testid="template-details">
      {inspected.status === 'loading' && (
        <p className={styles.muted}>
          <FormattedMessage id="templates.loading" />
        </p>
      )}
      {inspected.status === 'failed' && (
        <p className={styles.warningText}>
          <FormattedMessage id="templates.failed" />
        </p>
      )}
      {details && (
        <>
          {goal && (
            <p className={styles.editedFile}>
              <strong>
                <FormattedMessage id="brief.goal" />
              </strong>
              <span>{goal}</span>
            </p>
          )}
          {details.commands.length > 0 && (
            <p className={styles.editedFile}>
              <strong>
                <FormattedMessage id="templates.actions" />
              </strong>
              <code>{details.commands.join(', ')}</code>
            </p>
          )}
          <p className={styles.muted}>
            <FormattedMessage id="templates.files" values={{ count: details.files.length }} />
          </p>
        </>
      )}
      <div className={styles.noticeActions}>
        <Button size="md" variant="ghost" onClick={onClose}>
          <FormattedMessage id="templates.close" />
        </Button>
      </div>
    </div>
  );
}
