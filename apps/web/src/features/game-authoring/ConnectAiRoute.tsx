import { createAiConsent, type AiConsent } from '@playhoot/feature-game-authoring';
import { operations } from '@playhoot/protocol';
import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useSearchParams } from 'react-router';
import { useStore } from 'zustand';

import { useServices } from '../../app/ServicesContext';
import { AppShell, Button, Card, Owl, Stage } from '../../ui';
import { RequireOperation } from '../access';
import styles from './GameWorkspace.module.css';

// `/connect-ai?request=<id>`: an AI app (through MCP) asks to work with the account's games. The
// person approves or denies; either way the browser goes back to the AI app's URL the backend
// answers. Tokens are exchanged between the backend and the AI app: never shown nor kept here.
export function ConnectAiRoute() {
  return (
    <RequireOperation operation={operations.editGame}>
      <ConnectAi />
    </RequireOperation>
  );
}

function ConnectAi() {
  const services = useServices();
  const [params] = useSearchParams();
  const requestID = params.get('request') ?? '';
  const [consent, setConsent] = useState<AiConsent | null>(null);
  useEffect(() => {
    if (requestID === '') return;
    const next = createAiConsent({ access: services.aiAccess, requestID });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- created and disposed by this effect
    setConsent(next);
    void next.load();
    return () => next.dispose();
  }, [requestID, services]);
  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Owl size={96} />
          <h1 className={styles.heroTitle}>
            <FormattedMessage id="connectAi.title" />
          </h1>
        </div>
        <Card>{requestID === '' ? <Gone /> : consent && <Consent consent={consent} />}</Card>
      </Stage>
    </AppShell>
  );
}

function Consent({ consent }: { consent: AiConsent }) {
  const state = useStore(consent.store);
  useEffect(() => {
    if (state.status !== 'decided') return;
    // Only a web URL: never run a script URL a broken answer could carry.
    if (/^https?:\/\//i.test(state.redirectURL)) window.location.assign(state.redirectURL);
  }, [state]);

  if (state.status === 'loading' || state.status === 'decided') {
    return (
      <p className={styles.muted}>
        <FormattedMessage
          id={state.status === 'loading' ? 'connectAi.loading' : 'connectAi.returning'}
        />
      </p>
    );
  }
  if (state.status === 'gone') return <Gone />;
  if (state.status === 'failed') {
    return (
      <div className={styles.form}>
        <p className={styles.warningText} role="alert">
          <FormattedMessage id="connectAi.error" />
        </p>
        <Button variant="secondary" onClick={() => void consent.load()}>
          <FormattedMessage id="connectAi.retry" />
        </Button>
      </div>
    );
  }
  const { request, deciding, failed } = state;
  return (
    <div className={styles.form}>
      <p>
        <FormattedMessage
          id="connectAi.asks"
          values={{ client: request.clientName, strong: (chunks) => <strong>{chunks}</strong> }}
        />
      </p>
      <p className={styles.muted}>
        <FormattedMessage id="connectAi.returnsTo" values={{ host: request.redirectHost }} />
      </p>
      <div>
        <p className={styles.fieldLabel}>
          <FormattedMessage id="connectAi.canTitle" />
        </p>
        <ul>
          <li>
            <FormattedMessage id="connectAi.canChange" />
          </li>
          <li>
            <FormattedMessage id="connectAi.canBuild" />
          </li>
          <li>
            <FormattedMessage id="connectAi.canAssets" />
          </li>
          <li>
            <FormattedMessage id="connectAi.canCreate" />
          </li>
        </ul>
        <p className={styles.fieldLabel}>
          <FormattedMessage id="connectAi.cannotTitle" />
        </p>
        <ul>
          <li>
            <FormattedMessage id="connectAi.cannotPublish" />
          </li>
          <li>
            <FormattedMessage id="connectAi.cannotProfile" />
          </li>
        </ul>
      </div>
      <p className={styles.muted}>
        <FormattedMessage id="connectAi.revokeHint" />
      </p>
      {failed && (
        <p className={styles.warningText} role="alert">
          <FormattedMessage id="connectAi.decideError" />
        </p>
      )}
      <Button
        size="lg"
        block
        loading={deciding === 'approve'}
        disabled={deciding !== null}
        onClick={() => void consent.decide('approve')}
        data-testid="approve-ai"
      >
        <FormattedMessage id="connectAi.approve" />
      </Button>
      <Button
        variant="ghost"
        block
        loading={deciding === 'deny'}
        disabled={deciding !== null}
        onClick={() => void consent.decide('deny')}
        data-testid="deny-ai"
      >
        <FormattedMessage id="connectAi.deny" />
      </Button>
    </div>
  );
}

function Gone() {
  return (
    <p className={styles.muted} role="alert">
      <FormattedMessage id="connectAi.gone" />
    </p>
  );
}
