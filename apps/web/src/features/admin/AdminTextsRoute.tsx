import { createTextsPanel } from '@playhoot/feature-admin';
import { textKinds, textLanguages, type TextCatalogEntry } from '@playhoot/protocol';
import { useState, type FormEvent } from 'react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import {
  Button,
  Card,
  Dialog,
  PageHeading,
  Select,
  Status,
  StatusArea,
  TextareaField,
} from '../../ui';
import { textName } from '../compliance/AcceptanceGate';
import { adminErrorText } from './adminErrors';
import styles from './Admin.module.css';
import { useAdminPanel } from './useAdmin';

// What stands in for a value the backend did not set.
const noValue = '—';

// `/admin/texts`: the four acceptance texts by language (D-037), with the publish form that
// loads the real ones (P-23). Versions are immutable; publishing one never hides or changes the
// others, and a recorded acceptance keeps pointing at the exact version it accepted.
export function AdminTextsRoute() {
  const intl = useIntl();
  const { admin, compliance } = useServices();
  const { panel, state } = useAdminPanel(() => createTextsPanel({ admin }));
  const [reading, setReading] = useState<{ kind: string; language: string } | null>(null);
  const [readContent, setReadContent] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const byKind = new Map<string, TextCatalogEntry[]>();
  for (const entry of state.catalog) {
    byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry]);
  }

  const openReading = (kind: string, language: string) => {
    setReading({ kind, language });
    setReadContent(null);
    setReadError(null);
    void compliance.readText(kind, language).then((result) => {
      if (result.ok) setReadContent(result.value.content);
      else setReadError(intl.formatMessage({ id: 'admin.texts.readFailed' }));
    });
  };

  return (
    <div className={styles.panel}>
      <PageHeading
        title={intl.formatMessage({ id: 'admin.texts.title' })}
        lead={intl.formatMessage({ id: 'admin.texts.lead' })}
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
            <FormattedMessage
              id="admin.texts.published"
              values={{
                kind: textName(intl, state.result.kind),
                language: state.result.language,
                version: state.result.version,
              }}
            />
          </Status>
        )}
      </StatusArea>

      {textKinds.map((kind) => (
        <div className={styles.tableWrap} key={kind}>
          <table className={styles.table}>
            <caption>{textName(intl, kind)}</caption>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="admin.texts.column.language" />
                </th>
                <th scope="col" className={styles.numeric}>
                  <FormattedMessage id="admin.texts.column.version" />
                </th>
                <th scope="col">
                  <FormattedMessage id="admin.texts.column.publishedAt" />
                </th>
                <th scope="col">
                  <FormattedMessage id="admin.texts.column.olderVersions" />
                </th>
                <th scope="col">
                  <FormattedMessage id="admin.texts.column.actions" />
                </th>
              </tr>
            </thead>
            <tbody>
              {textLanguages.map((language) => {
                const entry = (byKind.get(kind) ?? []).find((each) => each.language === language);
                const latest = entry?.versions[0];
                const older = entry ? entry.versions.slice(1) : [];
                return (
                  <tr key={language}>
                    <th scope="row">{language}</th>
                    {latest ? (
                      <>
                        <td className={styles.numeric}>{latest.version}</td>
                        <td>
                          <FormattedDate
                            value={latest.published_at}
                            dateStyle="short"
                            timeStyle="short"
                          />
                        </td>
                        <td>
                          {older.length === 0
                            ? noValue
                            : intl.formatMessage(
                                { id: 'admin.texts.olderCount' },
                                { count: older.length },
                              )}
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openReading(kind, language)}
                            >
                              <FormattedMessage id="admin.texts.read" />
                            </Button>
                            <a
                              className={styles.download}
                              href={compliance.textDownloadUrl(kind, language)}
                              download
                            >
                              <FormattedMessage id="texts.download" />
                            </a>
                          </div>
                        </td>
                      </>
                    ) : (
                      <td colSpan={4}>
                        <FormattedMessage id="admin.texts.missing" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <Card>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FormattedMessage id="admin.texts.publishTitle" />
          </h2>
          <p className={styles.note}>
            <FormattedMessage id="admin.texts.immutableWarning" />
          </p>
          {state.actionError && (
            <Status tone="danger">
              <span>{adminErrorText(intl, state.actionError)}</span>
            </Status>
          )}
          <PublishForm busy={state.working} onSubmit={(request) => void panel.publish(request)} />
        </div>
      </Card>

      <Dialog
        open={reading !== null}
        title={reading ? textName(intl, reading.kind) : ''}
        closeLabel={intl.formatMessage({ id: 'admin.close' })}
        onClose={() => setReading(null)}
      >
        {readError ? (
          <p role="alert" className={styles.note}>
            {readError}
          </p>
        ) : readContent === null ? (
          <p className={styles.note}>
            <FormattedMessage id="texts.loading" />
          </p>
        ) : (
          <p className={styles.textContent}>{readContent}</p>
        )}
      </Dialog>
    </div>
  );
}

function PublishForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (request: { kind: string; language: string; content: string }) => void;
}) {
  const intl = useIntl();
  const [kind, setKind] = useState<string>(textKinds[0]);
  const [language, setLanguage] = useState<string>(textLanguages[0]);
  const [content, setContent] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (content.trim() === '') return;
    onSubmit({ kind, language, content: content.trim() });
    setPreviewing(false);
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.formRow}>
        <Select
          label={intl.formatMessage({ id: 'admin.texts.kindLabel' })}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {textKinds.map((each) => (
            <option key={each} value={each}>
              {textName(intl, each)}
            </option>
          ))}
        </Select>
        <Select
          label={intl.formatMessage({ id: 'admin.texts.column.language' })}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {textLanguages.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </Select>
      </div>
      <TextareaField
        label={intl.formatMessage({ id: 'admin.texts.contentLabel' })}
        hint={intl.formatMessage({ id: 'admin.texts.contentHint' })}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={14}
        required
      />
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPreviewing((current) => !current)}
          disabled={content.trim() === ''}
        >
          <FormattedMessage id={previewing ? 'admin.texts.hidePreview' : 'admin.texts.preview'} />
        </Button>
        <Button type="submit" loading={busy} disabled={content.trim() === ''}>
          <FormattedMessage id="admin.texts.publish" />
        </Button>
      </div>
      {previewing && <p className={styles.textContent}>{content}</p>}
    </form>
  );
}
