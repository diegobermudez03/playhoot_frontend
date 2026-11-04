import { createAiConnectionsList, type AiConnectionsList } from '@playhoot/feature-game-authoring';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Stage } from '../../ui';
import { RequireOperation } from '../access';
import styles from './GameWorkspace.module.css';

// `/account/ai-connections`: the AI apps connected to the account through MCP. Revoking one stops
// it at its next request; what it already read cannot be taken back.
export function AiConnectionsRoute() {
  return (
    <RequireOperation operation={operations.editGame}>
      <AiConnections />
    </RequireOperation>
  );
}

function AiConnections() {
  const services = useServices();
  const [list, setList] = useState<AiConnectionsList | null>(null);
  useEffect(() => {
    const next = createAiConnectionsList({ access: services.aiAccess });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setList(next);
    void next.load();
    return () => next.dispose();
  }, [services]);
  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            <FormattedMessage id="aiConnections.title" />
          </h1>
          <p className={styles.muted}>
            <FormattedMessage id="aiConnections.lead" />
          </p>
        </div>
        <Card>{list && <ConnectionsList list={list} />}</Card>
      </Stage>
    </AppShell>
  );
}

function ConnectionsList({ list }: { list: AiConnectionsList }) {
  const intl = useIntl();
  const { load, revoking, revokeFailed } = useStore(list.store);
  const [confirming, setConfirming] = useState<string | null>(null);
  if (load.status === 'loading') {
    return (
      <p className={styles.muted}>
        <FormattedMessage id="aiConnections.loading" />
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <div className={styles.form}>
        <p className={styles.warningText} role="alert">
          <FormattedMessage id="aiConnections.error" />
        </p>
        <Button variant="secondary" onClick={() => void list.load()}>
          <FormattedMessage id="aiConnections.retry" />
        </Button>
      </div>
    );
  }
  if (load.items.length === 0) {
    return (
      <p className={styles.muted}>
        <FormattedMessage id="aiConnections.empty" />
      </p>
    );
  }
  const date = (value: string) =>
    intl.formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className={styles.form}>
      {revokeFailed && (
        <p className={styles.warningText} role="alert">
          <FormattedMessage id="aiConnections.revokeError" />
        </p>
      )}
      <ul className={styles.list} data-testid="ai-connections">
        {load.items.map((connection) => (
          <li key={connection.connectionID} className={styles.listItem}>
            <div className={styles.listRow}>
              <strong>{connection.clientName}</strong>
              <span className={styles.muted}>
                <FormattedMessage
                  id="aiConnections.since"
                  values={{ date: date(connection.createdAt) }}
                />
              </span>
              <span className={styles.muted}>
                {connection.lastUsedAt ? (
                  <FormattedMessage
                    id="aiConnections.lastUsed"
                    values={{ date: date(connection.lastUsedAt) }}
                  />
                ) : (
                  <FormattedMessage id="aiConnections.neverUsed" />
                )}
              </span>
            </div>
            {confirming === connection.connectionID ? (
              <div className={styles.listRow}>
                <span>
                  <FormattedMessage
                    id="aiConnections.confirm"
                    values={{ client: connection.clientName }}
                  />
                </span>
                <Button
                  variant="danger"
                  loading={revoking === connection.connectionID}
                  disabled={revoking !== null}
                  onClick={() => {
                    setConfirming(null);
                    void list.revoke(connection.connectionID);
                  }}
                >
                  <FormattedMessage id="aiConnections.revoke" />
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  <FormattedMessage id="aiConnections.keep" />
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  variant="secondary"
                  disabled={revoking !== null}
                  onClick={() => setConfirming(connection.connectionID)}
                >
                  <FormattedMessage id="aiConnections.revoke" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
