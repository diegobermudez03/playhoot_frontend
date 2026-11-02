import type { GameAuthoring } from '@playhoot/feature-game-authoring';
import { useId, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { Button, Card } from '../../../ui';
import { ActionResultNotice } from '../ActionResultNotice';
import styles from '../GameWorkspace.module.css';

// "Archivos": the files of the current revision; one can be read and written directly, which
// makes a new revision with only that file changed.
export function FilesSection({ authoring }: { authoring: GameAuthoring }) {
  const intl = useIntl();
  const id = useId();
  const draft = useStore(authoring.store, (state) => state.draft)!;
  const busy = useStore(authoring.store, (state) => state.busy);
  const result = useStore(authoring.store, (state) => state.result);
  const [selected, setSelected] = useState<string | null>(draft.files[0]?.path ?? null);
  const [edited, setEdited] = useState<{ path: string; content: string } | null>(null);

  const file = draft.files.find((candidate) => candidate.path === selected) ?? null;
  const content = edited?.path === file?.path ? edited!.content : (file?.content ?? '');
  const dirty = file !== null && edited?.path === file.path && edited.content !== file.content;

  const save = async () => {
    if (!file || !dirty) return;
    const answer = await authoring.editFile(file.path, content);
    if (answer.kind === 'applied' || answer.kind === 'unchanged') setEdited(null);
  };

  return (
    <Card className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        <FormattedMessage id="files.title" values={{ revision: draft.currentRevision }} />
      </h2>
      <div className={styles.filesLayout}>
        <ul className={styles.fileList} data-testid="files">
          {draft.files.map((candidate) => (
            <li key={candidate.path}>
              <button
                type="button"
                className={[styles.fileItem, candidate.path === selected && styles.fileItemActive]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setSelected(candidate.path);
                  setEdited(null);
                }}
              >
                <code>{candidate.path}</code>
                <span className={styles.muted}>
                  <FormattedMessage id="files.size" values={{ size: candidate.size }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.fileEditor}>
          {file ? (
            <>
              <label className={styles.fieldLabel} htmlFor={id}>
                <FormattedMessage id="files.editLabel" values={{ path: file.path }} />
              </label>
              <textarea
                id={id}
                className={styles.code}
                rows={22}
                spellCheck={false}
                value={content}
                aria-label={intl.formatMessage({ id: 'files.editLabel' }, { path: file.path })}
                onChange={(event) => setEdited({ path: file.path, content: event.target.value })}
                data-testid="file-content"
              />
              <div className={styles.rowActions}>
                <Button
                  disabled={!dirty || busy !== null}
                  loading={busy === 'edit'}
                  onClick={() => void save()}
                  data-testid="save-file"
                >
                  <FormattedMessage id="files.save" />
                </Button>
                {dirty && (
                  <Button variant="ghost" onClick={() => setEdited(null)}>
                    <FormattedMessage id="files.discard" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className={styles.muted}>
              <FormattedMessage id="files.pick" />
            </p>
          )}
          {result && result.action === 'edit' && (
            <ActionResultNotice result={result} authoring={authoring} />
          )}
        </div>
      </div>
    </Card>
  );
}
